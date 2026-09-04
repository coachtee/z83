package za.co.naleli.z83.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import za.co.naleli.z83.app.network.ApiClient
import za.co.naleli.z83.app.ui.ApplicationDetailScreen
import za.co.naleli.z83.app.ui.ApplicationsScreen
import za.co.naleli.z83.app.ui.HomeScreen
import za.co.naleli.z83.app.ui.LoginScreen
import za.co.naleli.z83.app.ui.ProfileScreen
import za.co.naleli.z83.app.ui.RegisterScreen
import za.co.naleli.z83.app.ui.VacancyDetailScreen
import za.co.naleli.z83.app.ui.VacanciesScreen
import za.co.naleli.z83.app.ui.components.BOTTOM_NAV_DESTINATIONS
import za.co.naleli.z83.app.ui.components.Z83BottomNavBar
import za.co.naleli.z83.shared.User

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
 * The essential applicant journey (see docs/VERTICAL-SLICE.md and the
 * project's Android scope): login/register, profile (with qualifications,
 * work experience, references, documents as sections of one screen —
 * mirroring the web app), matching vacancies, apply, review, sign,
 * email/print, and My Applications. No WebView anywhere in this app.
 */
@Composable
fun Z83App() {
    val navController: NavHostController = rememberNavController()
    val apiClient = remember { ApiClient() }
    var currentUser by remember { mutableStateOf<User?>(null) }
    var checkedSession by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        currentUser = runCatching { apiClient.me() }.getOrNull()
        checkedSession = true
    }

    if (!checkedSession) return

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val isTabRoute = BOTTOM_NAV_DESTINATIONS.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (isTabRoute) {
                Z83BottomNavBar(currentRoute = currentRoute) { route ->
                    navController.navigate(route) {
                        popUpTo("home") { inclusive = false }
                        launchSingleTop = true
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = if (currentUser != null) "home" else "login",
            modifier = Modifier.padding(padding),
        ) {
            composable("login") {
                LoginScreen(
                    apiClient = apiClient,
                    onLoggedIn = {
                        navController.navigate("home") { popUpTo("login") { inclusive = true } }
                    },
                    onGoToRegister = { navController.navigate("register") },
                )
            }
            composable("register") {
                RegisterScreen(
                    apiClient = apiClient,
                    onRegistered = {
                        navController.navigate("home") { popUpTo("login") { inclusive = true } }
                    },
                    onGoToLogin = { navController.popBackStack() },
                )
            }
            composable("home") {
                val user = currentUser
                if (user != null) {
                    HomeScreen(
                        apiClient = apiClient,
                        user = user,
                        onOpenVacancy = { id -> navController.navigate("vacancy/$id") },
                        onOpenProfile = { navController.navigate("profile") },
                        onOpenVacancies = { navController.navigate("vacancies") },
                    )
                }
            }
            composable("vacancies") {
                VacanciesScreen(
                    apiClient = apiClient,
                    onOpenVacancy = { id -> navController.navigate("vacancy/$id") },
                )
            }
            composable("vacancy/{id}") { backStack ->
                val id = backStack.arguments?.getString("id") ?: return@composable
                VacancyDetailScreen(
                    apiClient = apiClient,
                    vacancyId = id,
                    onApplied = { applicationId -> navController.navigate("application/$applicationId") },
                )
            }
            composable("applications") {
                ApplicationsScreen(
                    apiClient = apiClient,
                    onOpenApplication = { id -> navController.navigate("application/$id") },
                )
            }
            composable("application/{id}") { backStack ->
                val id = backStack.arguments?.getString("id") ?: return@composable
                ApplicationDetailScreen(apiClient = apiClient, applicationId = id)
            }
            composable("profile") {
                ProfileScreen(
                    apiClient = apiClient,
                    onSignOut = {
                        currentUser = null
                        navController.navigate("login") {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
        }
    }
}
