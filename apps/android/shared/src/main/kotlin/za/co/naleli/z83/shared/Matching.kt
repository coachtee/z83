package za.co.naleli.z83.shared

import kotlinx.serialization.Serializable

@Serializable
data class MatchedRequirement(
    val requirementId: String,
    val description: String,
)

@Serializable
data class UnknownRequirement(
    val requirementId: String,
    val description: String,
    val reason: String,
)

/**
 * Deterministic, advisory match result — mirrors packages/types'
 * MatchResult exactly, computed server-side by
 * packages/validation's matching engine, never re-derived on-device.
 */
@Serializable
data class MatchResult(
    val percentage: Int,
    val matched: List<MatchedRequirement>,
    val missing: List<MatchedRequirement>,
    val unknown: List<UnknownRequirement>,
    val disclaimer: String,
)
