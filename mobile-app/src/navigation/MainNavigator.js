import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../components/ui';
import AlertDetailScreen from '../screens/AlertDetailScreen';
import AnnouncementDetailScreen from '../screens/AnnouncementDetailScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import AssistantScreen from '../screens/AssistantScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import HomeScreen from '../screens/HomeScreen';
import IncidentDetailScreen from '../screens/IncidentDetailScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import SafetyResourcesScreen from '../screens/SafetyResourcesScreen';
import SOSScreen from '../screens/SOSScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeRoot" component={HomeScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="SafetyResources" component={SafetyResourcesScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    </Stack.Navigator>
  );
};

const AlertStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AlertsRoot" component={AlertsScreen} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} />
    </Stack.Navigator>
  );
};

const ReportStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportRoot" component={ReportIncidentScreen} />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileRoot" component={ProfileScreen} />
      <Stack.Screen name="SafetyResources" component={SafetyResourcesScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-none';
          } else if (route.name === 'Assistant') {
            iconName = focused ? 'smart-toy' : 'smart-toy';
          } else if (route.name === 'Report') {
            iconName = focused ? 'add-alert' : 'outlined-flag';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: '#829196',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: colors.line,
          elevation: 8,
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Alerts" component={AlertStack} />
      <Tab.Screen name="Assistant" component={AssistantScreen} />
      <Tab.Screen name="Report" component={ReportStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

export default MainNavigator;