package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val email: String,
    val phone: String? = null,
    val role: UserRole,
    val fullName: String,
    val emailVerifiedAt: String? = null,
    val deletedAt: String? = null,
    val createdAt: String,
)
