package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
enum class UserRole {
    applicant,
    cafe_staff,
    admin,
}

@Serializable
enum class DocumentTypeCode {
    id_document,
    matric_certificate,
    qualification_certificate,
    cv,
    drivers_licence,
    professional_registration,
    other,
    z83_form_template,
}

@Serializable
enum class RequirementType {
    qualification,
    experience_years,
    drivers_licence,
    professional_registration,
    competency,
    other,
}

@Serializable
enum class SubmissionMethod {
    email,
    hand_delivery,
    online,
    either,
}

@Serializable
enum class VacancyStatus {
    pending_verification,
    published,
    closed,
    rejected,
}

@Serializable
enum class ApplicationStatus {
    draft,
    reviewed,
    signed,
    email_prepared,
    print_prepared,
    submitted,
    closed,
}

@Serializable
enum class LanguageProficiencyLevel {
    poor,
    fair,
    good,
}
