package za.co.naleli.z83.shared

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private val json = Json { ignoreUnknownKeys = true }

class SerializationTest {
    @Test
    fun `decodes a vacancy list item exactly as services api sends it`() {
        val body =
            """
            {
              "id": "v1",
              "circularId": "c1",
              "departmentId": "d1",
              "departmentName": "Department of Public Service and Administration",
              "jobTitle": "Administration Clerk: Registry Services",
              "referenceNumber": "DPSA/DEV/2026/001",
              "salaryText": "R202 233 per annum",
              "province": "Gauteng",
              "submissionMethod": "email",
              "submissionEmail": "recruitment@example.org",
              "status": "published",
              "createdAt": "2026-01-01T00:00:00.000Z",
              "matchPercentage": 75
            }
            """.trimIndent()

        val vacancy = json.decodeFromString<Vacancy>(body)

        assertEquals("Administration Clerk: Registry Services", vacancy.jobTitle)
        assertEquals(SubmissionMethod.email, vacancy.submissionMethod)
        assertEquals(75, vacancy.matchPercentage)
    }

    @Test
    fun `match result never claims eligibility in its own shape`() {
        val body =
            """
            {
              "percentage": 75,
              "matched": [{"requirementId": "r1", "description": "Grade 12"}],
              "missing": [],
              "unknown": [{"requirementId": "r2", "description": "PFMA knowledge", "reason": "Not captured"}],
              "disclaimer": "Your profile appears to match this vacancy. This is not a decision on eligibility."
            }
            """.trimIndent()

        val match = json.decodeFromString<MatchResult>(body)

        assertEquals(1, match.matched.size)
        assertEquals(1, match.unknown.size)
        assertEquals(true, match.disclaimer.contains("appears to match"))
    }

    @Test
    fun `profile fields absent from a partial profile decode as null`() {
        val body = """{"id":"p1","userId":"u1","updatedAt":"2026-01-01T00:00:00.000Z"}"""

        val profile = json.decodeFromString<Profile>(body)

        assertNull(profile.idNumber)
        assertNull(profile.driversLicenceCodes)
    }
}
