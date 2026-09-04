package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class VacancyRequirement(
    val id: String,
    val vacancyId: String,
    val requirementType: RequirementType,
    val description: String,
    val minimumValue: String? = null,
    val isMandatory: Boolean,
    val orderIndex: Int,
)

@Serializable
data class Vacancy(
    val id: String,
    val circularId: String,
    val departmentId: String,
    val departmentName: String,
    val jobTitle: String,
    val referenceNumber: String,
    val salaryText: String? = null,
    val province: String? = null,
    val locationText: String? = null,
    val pageNumber: Int? = null,
    val closingAt: String? = null,
    val submissionMethod: SubmissionMethod,
    val submissionEmail: String? = null,
    val submissionAddress: String? = null,
    val specialInstructions: String? = null,
    val status: VacancyStatus,
    val createdAt: String,
    // Present only on GET /vacancies list items, null on the detail endpoint.
    val matchPercentage: Int? = null,
)
