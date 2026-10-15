# Mobile Location Sharing

Officer location sharing requires an authenticated `security` or `security_officer` account and the **Share location by default** preference. The app requests foreground location permission and sends fresh device coordinates while its JavaScript runtime is active. Permission, GPS, stale-fix, and network errors are shown in the app; sharing stops when the preference is disabled.

This project does not implement background location tracking. Android may suspend the JavaScript timer when the app is backgrounded or terminated. Continuous background tracking would require an explicit user-visible location foreground service and the platform-specific permissions and lifecycle handling. There is no iOS native project in this repository, so iOS permission configuration and runtime behavior are not verified.
