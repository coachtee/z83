package za.co.naleli.z83.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.shared.AppDocument
import za.co.naleli.z83.shared.DocumentTypeCode
import za.co.naleli.z83.shared.FullProfile
import za.co.naleli.z83.shared.ProfileUpdateRequest
import za.co.naleli.z83.shared.QualificationRequest
import za.co.naleli.z83.shared.ReferenceRequest
import za.co.naleli.z83.shared.WorkExperienceRequest

private val DRIVERS_LICENCE_CODES = listOf("A", "A1", "B", "EB", "C1", "C", "EC1", "EC")

private val DOCUMENT_TYPES = listOf(
    DocumentTypeCode.id_document to "ID document",
    DocumentTypeCode.cv to "CV",
    DocumentTypeCode.qualification_certificate to "Qualification certificate",
    DocumentTypeCode.matric_certificate to "Matric certificate",
    DocumentTypeCode.drivers_licence to "Driver's licence",
    DocumentTypeCode.professional_registration to "Professional registration",
    DocumentTypeCode.other to "Other",
)

@Composable
fun ProfileScreen(apiClient: ApiClient, onSignOut: () -> Unit) {
    var profile by remember { mutableStateOf<FullProfile?>(null) }
    var documents by remember { mutableStateOf<List<AppDocument>>(emptyList()) }
    var refreshKey by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(refreshKey) {
        profile = apiClient.getProfile()
        documents = apiClient.listDocuments()
    }

    fun refresh() {
        scope.launch {
            profile = apiClient.getProfile()
            documents = apiClient.listDocuments()
        }
    }

    val current = profile ?: return

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { Text("Your Z83 profile", style = MaterialTheme.typography.headlineSmall) }
        item {
            PersonalParticularsSection(apiClient = apiClient, profile = current) { refresh() }
        }
        item {
            QualificationsSection(apiClient = apiClient, profile = current) { refresh() }
        }
        item {
            WorkExperienceSection(apiClient = apiClient, profile = current) { refresh() }
        }
        item {
            ReferencesSection(apiClient = apiClient, profile = current) { refresh() }
        }
        item {
            DocumentsSection(apiClient = apiClient, documents = documents) { refresh() }
        }
        item {
            androidx.compose.material3.OutlinedButton(onClick = {
                scope.launch {
                    apiClient.logout()
                    onSignOut()
                }
            }) {
                Text("Sign out")
            }
        }
    }
}

@Composable
private fun PersonalParticularsSection(apiClient: ApiClient, profile: FullProfile, onSaved: () -> Unit) {
    val p = profile.profile
    var idNumber by remember(p.id) { mutableStateOf(p.idNumber ?: "") }
    var dateOfBirth by remember(p.id) { mutableStateOf(p.dateOfBirth ?: "") }
    var gender by remember(p.id) { mutableStateOf(p.gender ?: "") }
    var nationality by remember(p.id) { mutableStateOf(p.nationality ?: "") }
    var race by remember(p.id) { mutableStateOf(p.race ?: "") }
    var addressLine1 by remember(p.id) { mutableStateOf(p.addressLine1 ?: "") }
    var city by remember(p.id) { mutableStateOf(p.city ?: "") }
    var province by remember(p.id) { mutableStateOf(p.province ?: "") }
    var postalCode by remember(p.id) { mutableStateOf(p.postalCode ?: "") }
    var phone by remember(p.id) { mutableStateOf(p.phone ?: "") }
    var email by remember(p.id) { mutableStateOf(p.email ?: "") }
    var licenceCodes by remember(p.id) { mutableStateOf((p.driversLicenceCodes ?: emptyList()).toSet()) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Personal particulars", style = MaterialTheme.typography.titleMedium)
            Text(
                "Use N/A-style blanks only where a field truly doesn't apply.",
                style = MaterialTheme.typography.bodySmall,
            )

            LabeledField("ID number", idNumber) { idNumber = it }
            LabeledField("Date of birth (YYYY-MM-DD)", dateOfBirth) { dateOfBirth = it }
            LabeledField("Gender", gender) { gender = it }
            LabeledField("Nationality", nationality) { nationality = it }
            LabeledField("Race", race) { race = it }
            LabeledField("Phone", phone) { phone = it }
            LabeledField("Email", email) { email = it }
            LabeledField("Address", addressLine1) { addressLine1 = it }
            LabeledField("City", city) { city = it }
            LabeledField("Province", province) { province = it }
            LabeledField("Postal code", postalCode) { postalCode = it }

            Text("Driver's licence codes", style = MaterialTheme.typography.labelLarge)
            for (row in DRIVERS_LICENCE_CODES.chunked(4)) {
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (code in row) {
                        FilterChip(
                            selected = licenceCodes.contains(code),
                            onClick = {
                                licenceCodes = if (licenceCodes.contains(code)) licenceCodes - code else licenceCodes + code
                            },
                            label = { Text(code) },
                        )
                    }
                }
            }

            Button(
                enabled = !saving,
                onClick = {
                    saving = true
                    saved = false
                    scope.launch {
                        apiClient.updateProfile(
                            ProfileUpdateRequest(
                                idNumber = idNumber.ifBlank { null },
                                dateOfBirth = dateOfBirth.ifBlank { null },
                                gender = gender.ifBlank { null },
                                nationality = nationality.ifBlank { null },
                                race = race.ifBlank { null },
                                addressLine1 = addressLine1.ifBlank { null },
                                city = city.ifBlank { null },
                                province = province.ifBlank { null },
                                postalCode = postalCode.ifBlank { null },
                                phone = phone.ifBlank { null },
                                email = email.ifBlank { null },
                                driversLicenceCodes = licenceCodes.toList(),
                            ),
                        )
                        saving = false
                        saved = true
                        onSaved()
                    }
                },
            ) {
                Text(if (saving) "Saving…" else "Save")
            }
            if (saved) Text("Saved.", color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun QualificationsSection(apiClient: ApiClient, profile: FullProfile, onAdded: () -> Unit) {
    var institution by remember { mutableStateOf("") }
    var qualificationName by remember { mutableStateOf("") }
    var nqfLevel by remember { mutableStateOf("") }
    var yearCompleted by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Qualifications", style = MaterialTheme.typography.titleMedium)
            for (q in profile.qualifications) {
                Text("${q.qualificationName} — ${q.institution}${q.yearCompleted?.let { ", $it" } ?: ""}")
            }
            HorizontalDivider()
            LabeledField("Institution", institution) { institution = it }
            LabeledField("Qualification name", qualificationName) { qualificationName = it }
            LabeledField("NQF level", nqfLevel) { nqfLevel = it }
            LabeledField("Year completed", yearCompleted) { yearCompleted = it }
            Button(onClick = {
                scope.launch {
                    apiClient.addQualification(
                        QualificationRequest(
                            institution = institution,
                            qualificationName = qualificationName,
                            nqfLevel = nqfLevel.toIntOrNull(),
                            yearCompleted = yearCompleted.toIntOrNull(),
                            stillStudying = false,
                            orderIndex = profile.qualifications.size,
                        ),
                    )
                    institution = ""
                    qualificationName = ""
                    nqfLevel = ""
                    yearCompleted = ""
                    onAdded()
                }
            }) {
                Text("Add qualification")
            }
        }
    }
}

@Composable
private fun WorkExperienceSection(apiClient: ApiClient, profile: FullProfile, onAdded: () -> Unit) {
    var employer by remember { mutableStateOf("") }
    var jobTitle by remember { mutableStateOf("") }
    var startDate by remember { mutableStateOf("") }
    var isCurrent by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Work experience", style = MaterialTheme.typography.titleMedium)
            for (w in profile.workExperience) {
                Text("${w.jobTitle} — ${w.employer}, ${w.startDate} – ${if (w.isCurrent) "present" else (w.endDate ?: "N/A")}")
            }
            HorizontalDivider()
            LabeledField("Employer", employer) { employer = it }
            LabeledField("Job title", jobTitle) { jobTitle = it }
            LabeledField("Start date (YYYY-MM-DD)", startDate) { startDate = it }
            androidx.compose.foundation.layout.Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                androidx.compose.material3.Checkbox(checked = isCurrent, onCheckedChange = { isCurrent = it })
                Text("This is my current job")
            }
            Button(onClick = {
                scope.launch {
                    apiClient.addWorkExperience(
                        WorkExperienceRequest(
                            employer = employer,
                            jobTitle = jobTitle,
                            startDate = startDate,
                            isCurrent = isCurrent,
                            orderIndex = profile.workExperience.size,
                        ),
                    )
                    employer = ""
                    jobTitle = ""
                    startDate = ""
                    isCurrent = false
                    onAdded()
                }
            }) {
                Text("Add work experience")
            }
        }
    }
}

@Composable
private fun ReferencesSection(apiClient: ApiClient, profile: FullProfile, onAdded: () -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var organisation by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("References", style = MaterialTheme.typography.titleMedium)
            Text("Most vacancies expect at least three.", style = MaterialTheme.typography.bodySmall)
            for (r in profile.references) {
                Text("${r.fullName} — ${listOfNotNull(r.organisation, r.phone, r.email).joinToString(" · ")}")
            }
            HorizontalDivider()
            LabeledField("Full name", fullName) { fullName = it }
            LabeledField("Organisation", organisation) { organisation = it }
            LabeledField("Phone", phone) { phone = it }
            LabeledField("Email", email) { email = it }
            Button(onClick = {
                scope.launch {
                    apiClient.addReference(
                        ReferenceRequest(
                            fullName = fullName,
                            organisation = organisation.ifBlank { null },
                            phone = phone.ifBlank { null },
                            email = email.ifBlank { null },
                            orderIndex = profile.references.size,
                        ),
                    )
                    fullName = ""
                    organisation = ""
                    phone = ""
                    email = ""
                    onAdded()
                }
            }) {
                Text("Add reference")
            }
        }
    }
}

@Composable
private fun DocumentsSection(apiClient: ApiClient, documents: List<AppDocument>, onUploaded: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pendingType by remember { mutableStateOf<DocumentTypeCode?>(null) }

    val pickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val type = pendingType
        if (uri != null && type != null) {
            scope.launch {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@launch
                val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
                apiClient.uploadDocument(bytes, "$type-${System.currentTimeMillis()}", type, mimeType)
                onUploaded()
            }
        }
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Documents", style = MaterialTheme.typography.titleMedium)
            Text("ID, CV, certificates and registrations — stored securely.", style = MaterialTheme.typography.bodySmall)
            for (doc in documents) {
                Text("${doc.originalFilename} (${doc.documentTypeCode})")
            }
            HorizontalDivider()
            for ((code, label) in DOCUMENT_TYPES) {
                Button(onClick = {
                    pendingType = code
                    pickerLauncher.launch("*/*")
                }) {
                    Text("Upload $label")
                }
            }
        }
    }
}

@Composable
private fun LabeledField(label: String, value: String, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
}
