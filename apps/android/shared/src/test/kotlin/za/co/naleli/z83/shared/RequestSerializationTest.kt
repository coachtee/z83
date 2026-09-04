package za.co.naleli.z83.shared

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

private val encodeJson = Json { encodeDefaults = true; explicitNulls = true }

class RequestSerializationTest {
    @Test
    fun `profile update sends explicit nulls for cleared fields`() {
        val request = ProfileUpdateRequest(idNumber = "9001015800083", gender = null)
        val encoded = encodeJson.encodeToString(ProfileUpdateRequest.serializer(), request)

        // Must include gender explicitly as null (not omit it) so the server
        // treats a cleared field as "clear this," matching web app behaviour.
        assertEquals(true, encoded.contains("\"gender\":null"))
        assertEquals(true, encoded.contains("\"idNumber\":\"9001015800083\""))
    }

    @Test
    fun `application status serializes as the same snake_case values the API uses`() {
        val request = UpdateStatusRequest(status = ApplicationStatus.email_prepared)
        val encoded = encodeJson.encodeToString(UpdateStatusRequest.serializer(), request)

        assertEquals("""{"status":"email_prepared"}""", encoded)
    }

    @Test
    fun `confirm-send request always sends confirm true explicitly`() {
        val encoded = encodeJson.encodeToString(ConfirmSendRequest.serializer(), ConfirmSendRequest(true))
        assertEquals("""{"confirm":true}""", encoded)
    }
}
