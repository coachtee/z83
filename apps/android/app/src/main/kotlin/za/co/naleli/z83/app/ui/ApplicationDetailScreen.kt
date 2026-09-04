package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.app.ui.components.SignaturePad
import za.co.naleli.z83.shared.ApplicationStatus
import za.co.naleli.z83.shared.EmailPackage
import za.co.naleli.z83.shared.SubmissionMethod
import za.co.naleli.z83.shared.ValidationReport

private fun statusLabel(status: ApplicationStatus): String = when (status) {
    ApplicationStatus.draft -> "Draft"
    ApplicationStatus.reviewed -> "Reviewed"
    ApplicationStatus.signed -> "Signed"
    ApplicationStatus.email_prepared -> "Email ready"
    ApplicationStatus.print_prepared -> "Print-ready"
    ApplicationStatus.submitted -> "Submitted"
    ApplicationStatus.closed -> "Closed"
}

@Composable
fun ApplicationDetailScreen(apiClient: ApiClient, applicationId: String) {
    var detail by remember { mutableStateOf<ApiClient.ApplicationDetail?>(null) }
    var review by remember { mutableStateOf<ValidationReport?>(null) }
    var emailPackage by remember { mutableStateOf<EmailPackage?>(null) }
    var printUrl by remember { mutableStateOf<String?>(null) }
    var sendResult by remember { mutableStateOf<ApiClient.SendResultResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        detail = apiClient.getApplication(applicationId)
    }

    LaunchedEffect(applicationId) {
        try {
            refresh()
        } catch (e: ApiClient.ApiException) {
            error = e.message
        }
    }

    fun runAction(block: suspend () -> Unit) {
        busy = true
        error = null
        scope.launch {
            try {
                block()
            } catch (e: ApiClient.ApiException) {
                error = e.message
            } finally {
                busy = false
            }
        }
    }

    val current = detail
    if (current == null) {
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp)) }
        return
    }
    val vacancy = current.vacancy ?: return
    val status = current.application.status

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(vacancy.jobTitle, style = MaterialTheme.typography.headlineSmall)
            Text("${vacancy.departmentName} · Ref: ${vacancy.referenceNumber}")
            Text("Status: ${statusLabel(status)}", style = MaterialTheme.typography.labelLarge)
            current.match?.let { Text("${it.percentage}% match at the time you applied") }
        }

        error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }

        if (status == ApplicationStatus.draft || status == ApplicationStatus.reviewed) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Review before you sign", style = MaterialTheme.typography.titleMedium)
                        Button(enabled = !busy, onClick = {
                            runAction {
                                review = apiClient.reviewApplication(applicationId)
                                refresh()
                            }
                        }) {
                            Text("Run review")
                        }
                        review?.checks?.forEach { check ->
                            Text(if (check.passed) "✓ ${check.rule.replace('_', ' ')}" else "✗ ${check.message}")
                        }
                    }
                }
            }
        }

        if ((status == ApplicationStatus.reviewed) && review?.complete == true) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Sign your application", style = MaterialTheme.typography.titleMedium)
                        SignaturePad(onCapture = { base64 ->
                            runAction {
                                apiClient.signApplication(applicationId, base64)
                                refresh()
                            }
                        })
                    }
                }
            }
        }

        if (status == ApplicationStatus.signed || status == ApplicationStatus.email_prepared || status == ApplicationStatus.print_prepared) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Send it", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Follow this vacancy's own submission instructions.",
                            style = MaterialTheme.typography.bodySmall,
                        )

                        if (vacancy.submissionMethod != SubmissionMethod.hand_delivery) {
                            OutlinedButton(enabled = !busy, onClick = {
                                runAction {
                                    emailPackage = apiClient.buildEmailPackage(applicationId).emailPackage
                                    refresh()
                                }
                            }) {
                                Text("Prepare email")
                            }
                        }
                        if (vacancy.submissionMethod != SubmissionMethod.email) {
                            OutlinedButton(enabled = !busy, onClick = {
                                runAction {
                                    printUrl = apiClient.buildPrintPackage(applicationId).url
                                    refresh()
                                }
                            }) {
                                Text("Prepare print-ready package")
                            }
                        }

                        emailPackage?.let { pkg ->
                            Text("Email prepared — not sent yet", style = MaterialTheme.typography.labelLarge)
                            Text("To: ${pkg.recipient}")
                            Text("Subject: ${pkg.subject}")
                            Text("${pkg.attachments.size} attachment(s).")
                            Button(enabled = !busy, onClick = {
                                runAction {
                                    sendResult = apiClient.sendApplication(applicationId)
                                    refresh()
                                }
                            }) {
                                Text("Send application")
                            }
                        }

                        printUrl?.let { url ->
                            Text("Print-ready package generated: $url")
                        }

                        sendResult?.let { result ->
                            if (result.success) {
                                Text("Sent to ${result.recipient}.", color = MaterialTheme.colorScheme.primary)
                            } else {
                                Text(
                                    "Sending failed: ${result.error ?: "unknown error"}. Nothing was submitted — try again.",
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                        }

                        if (status == ApplicationStatus.print_prepared) {
                            Button(enabled = !busy, onClick = {
                                runAction {
                                    apiClient.updateApplicationStatus(applicationId, ApplicationStatus.submitted)
                                    refresh()
                                }
                            }) {
                                Text("I've delivered this — mark as submitted")
                            }
                        }
                    }
                }
            }
        }

        if (status == ApplicationStatus.submitted) {
            item { Text("Submitted. Good luck.", style = MaterialTheme.typography.titleMedium) }
        }
    }
}
