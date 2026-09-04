package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    val id: String,
    val userId: String,
    val idNumber: String? = null,
    val passportNumber: String? = null,
    val dateOfBirth: String? = null,
    val gender: String? = null,
    val nationality: String? = null,
    val race: String? = null,
    val disabilityStatus: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val city: String? = null,
    val province: String? = null,
    val postalCode: String? = null,
    val phone: String? = null,
    val altPhone: String? = null,
    val email: String? = null,
    val driversLicenceCodes: List<String>? = null,
    val professionalRegistrations: List<String>? = null,
    val currentVersionId: String? = null,
    val updatedAt: String,
)

@Serializable
data class Qualification(
    val id: String,
    val profileId: String,
    val institution: String,
    val qualificationName: String,
    val fieldOfStudy: String? = null,
    val nqfLevel: Int? = null,
    val yearCompleted: Int? = null,
    val stillStudying: Boolean,
    val orderIndex: Int,
)

@Serializable
data class WorkExperience(
    val id: String,
    val profileId: String,
    val employer: String,
    val jobTitle: String,
    val startDate: String,
    val endDate: String? = null,
    val isCurrent: Boolean,
    val responsibilities: String? = null,
    val orderIndex: Int,
)

@Serializable
data class LanguageSkill(
    val id: String,
    val profileId: String,
    val language: String,
    val speakLevel: LanguageProficiencyLevel,
    val readLevel: LanguageProficiencyLevel,
    val writeLevel: LanguageProficiencyLevel,
)

@Serializable
data class ApplicantReference(
    val id: String,
    val profileId: String,
    val fullName: String,
    val relationship: String? = null,
    val organisation: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val orderIndex: Int,
)

@Serializable
data class FullProfile(
    val profile: Profile,
    val qualifications: List<Qualification> = emptyList(),
    val workExperience: List<WorkExperience> = emptyList(),
    val languages: List<LanguageSkill> = emptyList(),
    val references: List<ApplicantReference> = emptyList(),
)
