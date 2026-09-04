package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.shared.Application

private val STATUS_LABELS = mapOf(
    "draft" to "Draft",
    "reviewed" to "Reviewed",
    "signed" to "Signed",
    "email_prepared" to "Email ready",
    "print_prepared" to "Print-ready",
    "submitted" to "Submitted",
    "closed" to "Closed",
)

@Composable
fun ApplicationsScreen(apiClient: ApiClient, onOpenApplication: (String) -> Unit) {
    var applications by remember { mutableStateOf<List<Application>?>(null) }

    LaunchedEffect(Unit) {
        applications = apiClient.listApplications()
    }

    val current = applications ?: return

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        if (current.isEmpty()) {
            item { Text("No applications yet. Find a vacancy and tap Apply to start one.") }
        }
        items(current) { application ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                onClick = { onOpenApplication(application.id) },
                colors = CardDefaults.cardColors(),
            ) {
                androidx.compose.foundation.layout.Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
                ) {
                    Text("Started ${application.createdAt.take(10)}")
                    Text(STATUS_LABELS[application.status.name] ?: application.status.name)
                }
            }
        }
    }
}
