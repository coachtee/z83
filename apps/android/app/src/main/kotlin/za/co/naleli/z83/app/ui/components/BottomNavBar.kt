package za.co.naleli.z83.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

data class BottomNavDestination(val route: String, val label: String)

val BOTTOM_NAV_DESTINATIONS = listOf(
    BottomNavDestination("home", "Home"),
    BottomNavDestination("vacancies", "Vacancies"),
    BottomNavDestination("applications", "Applications"),
    BottomNavDestination("profile", "Profile"),
)

@Composable
fun Z83BottomNavBar(currentRoute: String?, onNavigate: (String) -> Unit) {
    NavigationBar {
        for (destination in BOTTOM_NAV_DESTINATIONS) {
            NavigationBarItem(
                selected = currentRoute == destination.route,
                onClick = { onNavigate(destination.route) },
                icon = {
                    Icon(
                        imageVector = when (destination.route) {
                            "home" -> Icons.Filled.Home
                            "vacancies" -> Icons.Filled.Work
                            "applications" -> Icons.Filled.Description
                            else -> Icons.Filled.Person
                        },
                        contentDescription = destination.label,
                    )
                },
                label = { Text(destination.label) },
            )
        }
    }
}
