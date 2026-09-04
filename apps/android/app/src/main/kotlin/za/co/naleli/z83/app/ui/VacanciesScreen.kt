package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import za.co.naleli.z83.shared.Vacancy

@Composable
fun VacanciesScreen(apiClient: ApiClient, onOpenVacancy: (String) -> Unit) {
    var vacancies by remember { mutableStateOf<List<Vacancy>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            vacancies = apiClient.listVacancies()
        } catch (e: ApiClient.ApiException) {
            error = e.message
        }
    }

    val current = vacancies
    if (current == null) {
        val currentError = error
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            if (currentError != null) {
                Text(currentError, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            } else {
                CircularProgressIndicator(modifier = Modifier.padding(24.dp))
            }
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        items(current) { vacancy ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                onClick = { onOpenVacancy(vacancy.id) },
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(vacancy.jobTitle, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                    Text("${vacancy.departmentName} · ${vacancy.province ?: "N/A"}")
                    vacancy.matchPercentage?.let { Text("$it% match") }
                }
            }
        }
    }
}
