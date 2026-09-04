package za.co.naleli.z83.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import za.co.naleli.z83.shared.Application
import za.co.naleli.z83.shared.ApplicationDocument
import za.co.naleli.z83.shared.ApplicationStatus
import za.co.naleli.z83.shared.ApplicationSnapshot
import za.co.naleli.z83.shared.AppDocument
import za.co.naleli.z83.shared.ConfirmSendRequest
import za.co.naleli.z83.shared.CreateApplicationRequest
import za.co.naleli.z83.shared.DocumentTypeCode
import za.co.naleli.z83.shared.EmailPackage
import za.co.naleli.z83.shared.FullProfile
import za.co.naleli.z83.shared.LoginRequest
import za.co.naleli.z83.shared.MatchResult
import za.co.naleli.z83.shared.Profile
import za.co.naleli.z83.shared.ProfileUpdateRequest
import za.co.naleli.z83.shared.Qualification
import za.co.naleli.z83.shared.QualificationRequest
import za.co.naleli.z83.shared.ApplicantReference
import za.co.naleli.z83.shared.ReferenceRequest
import za.co.naleli.z83.shared.RegisterRequest
import za.co.naleli.z83.shared.SignApplicationRequest
import za.co.naleli.z83.shared.UpdateStatusRequest
import za.co.naleli.z83.shared.User
import za.co.naleli.z83.shared.Vacancy
import za.co.naleli.z83.shared.VacancyRequirement
import za.co.naleli.z83.shared.ValidationReport
import za.co.naleli.z83.shared.WorkExperience
import za.co.naleli.z83.shared.WorkExperienceRequest

/**
 * Talks to the same REST API (services/api) the web app uses — see
 * docs/API.md. No business logic lives here: matching, validation and
 * snapshotting all happen server-side, exactly as for the web client.
 */
class ApiClient(private val baseUrl: String = "http://10.0.2.2:4000") {

    // 10.0.2.2 is the Android emulator's alias for the host machine's
    // localhost, matching services/api running in dev on the host.

    private val decodeJson = Json { ignoreUnknownKeys = true }
    private val encodeJson = Json { encodeDefaults = true; explicitNulls = true }

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

    private suspend fun <T> execute(request: Request, deserializer: DeserializationStrategy<T>?): T? =
        withContext(Dispatchers.IO) {
            client.newCall(request).execute().use { response ->
                val bodyString = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val error = runCatching { decodeJson.decodeFromString<ErrorBody>(bodyString) }.getOrNull()
                    throw ApiException(
                        response.code,
                        error?.error?.code ?: "UNKNOWN",
                        error?.error?.message ?: "Something went wrong.",
                    )
                }
                if (deserializer == null || bodyString.isBlank()) null
                else decodeJson.decodeFromString(deserializer, bodyString)
            }
        }

    private fun <B> jsonBody(serializer: SerializationStrategy<B>, body: B): RequestBody =
        encodeJson.encodeToString(serializer, body).toRequestBody("application/json".toMediaType())

    private suspend inline fun <reified T> getJson(path: String): T =
        execute(Request.Builder().url("$baseUrl$path").build(), serializer<T>())!!

    private suspend inline fun <reified B, reified T> postJson(path: String, body: B): T =
        execute(
            Request.Builder().url("$baseUrl$path").post(jsonBody(serializer<B>(), body)).build(),
            serializer<T>(),
        )!!

    private suspend fun postEmpty(path: String) {
        execute<Unit>(
            Request.Builder().url("$baseUrl$path").post("".toRequestBody(null)).build(),
            null,
        )
    }

    private suspend inline fun <reified T> postEmptyJson(path: String): T =
        execute(
            Request.Builder().url("$baseUrl$path").post("".toRequestBody(null)).build(),
            serializer<T>(),
        )!!

    private suspend inline fun <reified B, reified T> putJson(path: String, body: B): T =
        execute(
            Request.Builder().url("$baseUrl$path").put(jsonBody(serializer<B>(), body)).build(),
            serializer<T>(),
        )!!

    private suspend inline fun <reified B, reified T> patchJson(path: String, body: B): T =
        execute(
            Request.Builder().url("$baseUrl$path").patch(jsonBody(serializer<B>(), body)).build(),
            serializer<T>(),
        )!!

    private suspend fun delete(path: String) {
        execute<Unit>(Request.Builder().url("$baseUrl$path").delete().build(), null)
    }

    // --- Auth ---

    suspend fun register(email: String, password: String, fullName: String): User =
        postJson<RegisterRequest, UserResponse>("/auth/register", RegisterRequest(email, password, fullName)).user

    suspend fun login(email: String, password: String): User =
        postJson<LoginRequest, UserResponse>("/auth/login", LoginRequest(email, password)).user

    suspend fun logout() = postEmpty("/auth/logout")

    suspend fun me(): User = getJson<UserResponse>("/auth/me").user

    // --- Profile ---

    suspend fun getProfile(): FullProfile = getJson("/profile")

    suspend fun updateProfile(input: ProfileUpdateRequest): Profile =
        putJson<ProfileUpdateRequest, ProfileResponse>("/profile", input).profile

    suspend fun getCompleteness(): ValidationReport = getJson("/profile/completeness")

    suspend fun addQualification(input: QualificationRequest): Qualification =
        postJson<QualificationRequest, QualificationResponse>("/profile/qualifications", input).qualification

    suspend fun deleteQualification(id: String) = delete("/profile/qualifications/$id")

    suspend fun addWorkExperience(input: WorkExperienceRequest): WorkExperience =
        postJson<WorkExperienceRequest, WorkExperienceResponse>("/profile/work-experience", input).experience

    suspend fun addReference(input: ReferenceRequest): ApplicantReference =
        postJson<ReferenceRequest, ReferenceResponse>("/profile/references", input).reference

    // --- Documents ---

    suspend fun listDocuments(): List<AppDocument> = getJson<DocumentsResponse>("/documents").documents

    /**
     * Takes raw bytes rather than a File — on Android, a picked document is
     * a content:// Uri, not a filesystem path, so the caller reads it via
     * ContentResolver.openInputStream() first (see ProfileScreen's
     * DocumentsSection, the only caller).
     */
    suspend fun uploadDocument(
        bytes: ByteArray,
        filename: String,
        documentTypeCode: DocumentTypeCode,
        mimeType: String,
    ): AppDocument =
        withContext(Dispatchers.IO) {
            val multipart = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("documentTypeCode", documentTypeCode.name)
                .addFormDataPart("file", filename, bytes.toRequestBody(mimeType.toMediaType()))
                .build()
            val request = Request.Builder().url("$baseUrl/documents").post(multipart).build()
            execute(request, serializer<DocumentResponse>())!!.document
        }

    suspend fun getDocumentUrl(id: String): String = getJson<UrlResponse>("/documents/$id/url").url

    suspend fun deleteDocument(id: String) = delete("/documents/$id")

    // --- Vacancies ---

    suspend fun listVacancies(): List<Vacancy> = getJson<VacanciesResponse>("/vacancies").vacancies

    suspend fun getVacancy(id: String): VacancyDetail = getJson("/vacancies/$id")

    // --- Applications ---

    suspend fun listApplications(): List<Application> = getJson<ApplicationsResponse>("/applications").applications

    suspend fun createApplication(vacancyId: String): Application =
        postJson<CreateApplicationRequest, ApplicationResponse>(
            "/applications",
            CreateApplicationRequest(vacancyId),
        ).application

    suspend fun getApplication(id: String): ApplicationDetail = getJson("/applications/$id")

    suspend fun reviewApplication(id: String): ValidationReport = postEmptyJson("/applications/$id/review")

    suspend fun signApplication(id: String, imageBase64: String): StatusOnlyResponse =
        postJson("/applications/$id/sign", SignApplicationRequest(imageBase64))

    suspend fun buildEmailPackage(id: String): EmailPackageResponse = postEmptyJson("/applications/$id/email-package")

    suspend fun buildPrintPackage(id: String): PrintPackageResponse = postEmptyJson("/applications/$id/print-package")

    suspend fun sendApplication(id: String): SendResultResponse =
        postJson("/applications/$id/send", ConfirmSendRequest(confirm = true))

    suspend fun updateApplicationStatus(id: String, status: ApplicationStatus): Application =
        patchJson<UpdateStatusRequest, ApplicationResponse>(
            "/applications/$id/status",
            UpdateStatusRequest(status),
        ).application

    // --- Response wrapper shapes (mirroring docs/API.md exactly) ---

    @Serializable
    private data class UserResponse(val user: User)

    @Serializable
    private data class ProfileResponse(val profile: Profile)

    @Serializable
    private data class QualificationResponse(val qualification: Qualification)

    @Serializable
    private data class WorkExperienceResponse(val experience: WorkExperience)

    @Serializable
    private data class ReferenceResponse(val reference: ApplicantReference)

    @Serializable
    private data class DocumentsResponse(val documents: List<AppDocument>)

    @Serializable
    private data class DocumentResponse(val document: AppDocument)

    @Serializable
    private data class UrlResponse(val url: String, val expiresInSeconds: Int)

    @Serializable
    private data class VacanciesResponse(val vacancies: List<Vacancy>)

    @Serializable
    data class VacancyDetail(
        val vacancy: Vacancy,
        val requirements: List<VacancyRequirement>,
        val match: MatchResult? = null,
    )

    @Serializable
    private data class ApplicationsResponse(val applications: List<Application>)

    @Serializable
    private data class ApplicationResponse(val application: Application)

    @Serializable
    data class ApplicationDetail(
        val application: Application,
        val snapshot: ApplicationSnapshot? = null,
        val vacancy: Vacancy? = null,
        val documents: List<ApplicationDocument> = emptyList(),
        val match: MatchResult? = null,
    )

    @Serializable
    data class StatusOnlyResponse(val status: String)

    @Serializable
    data class EmailPackageResponse(val emailPackage: EmailPackage, val sent: Boolean)

    @Serializable
    data class PrintPackageResponse(val url: String, val expiresInSeconds: Int)

    @Serializable
    data class SendResultResponse(
        val success: Boolean,
        val recipient: String,
        val attemptedAt: String,
        val error: String? = null,
    )
}
