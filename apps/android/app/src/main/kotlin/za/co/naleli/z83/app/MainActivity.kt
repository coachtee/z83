package za.co.naleli.z83.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.app.ui.LoginScreen
import za.co.naleli.z83.app.ui.VacancyDetailScreen
import za.co.naleli.z83.app.ui.VacanciesScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier) {
                    Z83App()
                }
            }
        }
    }
}

/**
 * Read-only vertical-slice scope on Android, matching
 * docs/VERTICAL-SLICE.md: sign in, browse vacancies, see why a vacancy
 * matches. Profile editing, applying, and signing are web-first for now.
 */
@Composable
fun Z83App() {
    val navController: NavHostController = rememberNavController()
    val apiClient = remember { ApiClient() }

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                apiClient = apiClient,
                onLoggedIn = { navController.navigate("vacancies") },
            )
        }
        composable("vacancies") {
            VacanciesScreen(
                apiClient = apiClient,
                onOpenVacancy = { id -> navController.navigate("vacancy/$id") },
            )
        }
        composable("vacancy/{id}") { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id") ?: return@composable
            VacancyDetailScreen(apiClient = apiClient, vacancyId = id)
        }
    }
}
