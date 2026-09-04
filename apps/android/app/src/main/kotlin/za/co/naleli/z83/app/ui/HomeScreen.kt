package za.co.naleli.z83.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import za.co.naleli.z83.shared.User
import za.co.naleli.z83.shared.Vacancy
import za.co.naleli.z83.shared.ValidationReport

@Composable
fun HomeScreen(
    apiClient: ApiClient,
    user: User,
    onOpenVacancy: (String) -> Unit,
    onOpenProfile: () -> Unit,
    onOpenVacancies: () -> Unit,
) {
    var completeness by remember { mutableStateOf<ValidationReport?>(null) }
    var topMatches by remember { mutableStateOf<List<Vacancy>>(emptyList()) }

    LaunchedEffect(Unit) {
        completeness = apiClient.getCompleteness()
        topMatches = apiClient.listVacancies().take(3)
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Welcome back, ${user.fullName.substringBefore(" ")}", style = MaterialTheme.typography.titleLarge)

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Profile completeness", style = MaterialTheme.typography.titleMedium)
                completeness?.let { report ->
                    val passed = report.checks.count { it.passed }
                    val total = report.checks.size
                    val fraction = if (total > 0) passed.toFloat() / total else 0f
                    LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth())
                    Text("$passed of $total checks passed.")
                }
                Button(onClick = onOpenProfile) { Text("Complete your profile") }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Vacancies that might match you", style = MaterialTheme.typography.titleMedium)
                if (topMatches.isEmpty()) {
                    Text("No published vacancies yet.")
                }
                for (vacancy in topMatches) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        androidx.compose.material3.TextButton(onClick = { onOpenVacancy(vacancy.id) }) {
                            Column {
                                Text(vacancy.jobTitle)
                                vacancy.matchPercentage?.let { Text("$it% match") }
                            }
                        }
                    }
                }
                Button(onClick = onOpenVacancies) { Text("See all vacancies") }
            }
        }
    }
}
