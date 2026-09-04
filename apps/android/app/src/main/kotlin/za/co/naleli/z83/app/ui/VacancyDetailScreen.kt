package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import za.co.naleli.z83.app.network.ApiClient

@Composable
fun VacancyDetailScreen(apiClient: ApiClient, vacancyId: String) {
    var detail by remember { mutableStateOf<ApiClient.VacancyDetail?>(null) }

    LaunchedEffect(vacancyId) {
        detail = apiClient.getVacancy(vacancyId)
    }

    val current = detail ?: return

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        item {
            Text(current.vacancy.jobTitle, style = MaterialTheme.typography.headlineSmall)
            Text("${current.vacancy.departmentName} · Ref: ${current.vacancy.referenceNumber}")
            Text(current.vacancy.salaryText ?: "Salary: N/A")

            current.match?.let { match ->
                Column(modifier = Modifier.padding(vertical = 16.dp)) {
                    Text("Why this matches", style = MaterialTheme.typography.titleMedium)
                    Text(match.disclaimer, style = MaterialTheme.typography.bodySmall)
                    LinearProgressIndicator(
                        progress = { match.percentage / 100f },
                        modifier = Modifier.fillMaxSize().padding(vertical = 8.dp),
                    )
                    Text("${match.percentage}%")
                }
            }
        }

        current.match?.matched?.let { matched ->
            items(matched) { item -> Text("✓ ${item.description}") }
        }
        current.match?.missing?.let { missing ->
            items(missing) { item -> Text("✗ ${item.description}") }
        }
        current.match?.unknown?.let { unknown ->
            items(unknown) { item -> Text("? ${item.description} (${item.reason})") }
        }

        item {
            Text("Requirements as published", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        }
        items(current.requirements) { requirement ->
            Text("• ${requirement.description}")
        }
    }
}
