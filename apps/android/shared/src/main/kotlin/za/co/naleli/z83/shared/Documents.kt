package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class AppDocument(
    val id: String,
    val ownerUserId: String,
    val documentTypeId: String,
    val documentTypeCode: DocumentTypeCode,
    val originalFilename: String,
    val mimeType: String,
    val sizeBytes: Int,
    val verifiedAt: String? = null,
    val deletedAt: String? = null,
    val createdAt: String,
)

@Serializable
data class ApplicationDocument(
    val id: String,
    val applicationId: String,
    val documentId: String? = null,
    val documentRole: String,
    val storageKey: String? = null,
    val orderIndex: Int,
)
