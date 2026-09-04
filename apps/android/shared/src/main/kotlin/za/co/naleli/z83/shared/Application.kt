package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class Application(
    val id: String,
    val userId: String,
    val vacancyId: String,
    val snapshotId: String? = null,
    val status: ApplicationStatus,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SnapshotDocumentRef(
    val id: String,
    val documentTypeCode: String,
    val originalFilename: String,
)

@Serializable
data class ApplicationSnapshotData(
    val profile: Profile,
    val qualifications: List<Qualification> = emptyList(),
    val workExperience: List<WorkExperience> = emptyList(),
    val languages: List<LanguageSkill> = emptyList(),
    val references: List<ApplicantReference> = emptyList(),
    val documents: List<SnapshotDocumentRef> = emptyList(),
    val capturedAt: String,
)

@Serializable
data class ApplicationSnapshot(
    val id: String,
    val applicationId: String,
    val snapshotData: ApplicationSnapshotData,
    val createdAt: String,
)

@Serializable
data class ValidationCheckResult(
    val rule: String,
    val passed: Boolean,
    val message: String? = null,
)

@Serializable
data class ValidationReport(
    val complete: Boolean,
    val checks: List<ValidationCheckResult>,
)

@Serializable
data class EmailAttachment(
    val label: String,
    val storageKey: String,
)

@Serializable
data class EmailPackage(
    val recipient: String,
    val subject: String,
    val body: String,
    val attachments: List<EmailAttachment>,
)
