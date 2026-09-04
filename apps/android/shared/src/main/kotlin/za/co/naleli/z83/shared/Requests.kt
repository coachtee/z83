package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

/**
 * Request bodies sent to services/api. Mirrors packages/validation's Zod
 * schemas field-for-field — see docs/API.md.
 */
@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val fullName: String,
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

/**
 * Sent with every profile save — the same "whole form, every field" pattern
 * the web app uses (see apps/web ProfilePage): an empty field means null,
 * clearing it server-side, exactly as if the field were left blank on web.
 */
@Serializable
data class ProfileUpdateRequest(
    val idNumber: String? = null,
    val dateOfBirth: String? = null,
    val gender: String? = null,
    val nationality: String? = null,
    val race: String? = null,
    val addressLine1: String? = null,
    val city: String? = null,
    val province: String? = null,
    val postalCode: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val driversLicenceCodes: List<String>? = null,
)

@Serializable
data class QualificationRequest(
    val institution: String,
    val qualificationName: String,
    val fieldOfStudy: String? = null,
    val nqfLevel: Int? = null,
    val yearCompleted: Int? = null,
    val stillStudying: Boolean = false,
    val orderIndex: Int,
)

@Serializable
data class WorkExperienceRequest(
    val employer: String,
    val jobTitle: String,
    val startDate: String,
    val endDate: String? = null,
    val isCurrent: Boolean = false,
    val orderIndex: Int,
)

@Serializable
data class ReferenceRequest(
    val fullName: String,
    val relationship: String? = null,
    val organisation: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val orderIndex: Int,
)

@Serializable
data class CreateApplicationRequest(
    val vacancyId: String,
)

@Serializable
data class SignApplicationRequest(
    val imageBase64: String,
)

@Serializable
data class UpdateStatusRequest(
    val status: ApplicationStatus,
)

@Serializable
data class ConfirmSendRequest(
    val confirm: Boolean,
)
