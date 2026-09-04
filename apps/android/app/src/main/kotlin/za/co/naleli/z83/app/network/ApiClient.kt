package za.co.naleli.z83.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.serializer
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import za.co.naleli.z83.shared.User
import za.co.naleli.z83.shared.Vacancy
import za.co.naleli.z83.shared.VacancyRequirement
import za.co.naleli.z83.shared.MatchResult
import kotlinx.serialization.Serializable

/**
 * Talks to the same REST API (services/api) the web app uses — see
 * docs/API.md. No business logic lives here: matching, validation and
 * snapshotting all happen server-side, exactly as for the web client.
 */
class ApiClient(private val baseUrl: String = "http://10.0.2.2:4000") {

    // 10.0.2.2 is the Android emulator's alias for the host machine's
    // localhost, matching services/api running in dev on the host.

    private val json = Json { ignoreUnknownKeys = true }

    private val inMemoryCookies = mutableListOf<Cookie>()

    private val client = OkHttpClient.Builder()
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                inMemoryCookies.removeAll { existing -> cookies.any { it.name == existing.name } }
                inMemoryCookies.addAll(cookies)
            }

            override fun loadForRequest(url: HttpUrl): List<Cookie> = inMemoryCookies
        })
        .build()

    class ApiException(val statusCode: Int, val apiCode: String, message: String) : Exception(message)

    @Serializable
    private data class ErrorBody(val error: ErrorDetail)

    @Serializable
    private data class ErrorDetail(val code: String, val message: String)

    private suspend fun <T> execute(request: Request, deserializer: SerializationStrategy<T>? = null): T? =
        withContext(Dispatchers.IO) {
            client.newCall(request).execute().use { response ->
                val bodyString = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val error = runCatching { json.decodeFromString<ErrorBody>(bodyString) }.getOrNull()
                    throw ApiException(
                        response.code,
                        error?.error?.code ?: "UNKNOWN",
                        error?.error?.message ?: "Something went wrong.",
                    )
                }
                if (deserializer == null || bodyString.isBlank()) null
                else json.decodeFromString(deserializer, bodyString)
            }
        }

    suspend fun login(email: String, password: String): User {
        val payload = json.encodeToString(
            MapSerializer(),
            mapOf("email" to email, "password" to password),
        )
        val request = Request.Builder()
            .url("$baseUrl/auth/login")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()
        val response = execute(request, serializer<LoginResponse>())
        return response!!.user
    }

    suspend fun me(): User {
        val request = Request.Builder().url("$baseUrl/auth/me").build()
        return execute(request, serializer<MeResponse>())!!.user
    }

    suspend fun listVacancies(): List<Vacancy> {
        val request = Request.Builder().url("$baseUrl/vacancies").build()
        return execute(request, serializer<VacanciesResponse>())!!.vacancies
    }

    suspend fun getVacancy(id: String): VacancyDetail {
        val request = Request.Builder().url("$baseUrl/vacancies/$id").build()
        return execute(request, serializer<VacancyDetail>())!!
    }

    @Serializable
    private data class LoginResponse(val user: User)

    @Serializable
    private data class MeResponse(val user: User)

    @Serializable
    private data class VacanciesResponse(val vacancies: List<Vacancy>)

    @Serializable
    data class VacancyDetail(
        val vacancy: Vacancy,
        val requirements: List<VacancyRequirement>,
        val match: MatchResult?,
    )
}

// A tiny helper so login() can encode a plain string map without pulling
// in a bigger JSON-building dependency.
private fun MapSerializer() = kotlinx.serialization.builtins.MapSerializer(
    kotlinx.serialization.builtins.serializer<String>(),
    kotlinx.serialization.builtins.serializer<String>(),
)
