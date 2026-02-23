import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import SpecialOfferScreen from '../screens/SpecialOfferScreen';
import VerifyScreen from '../screens/VerifyScreen';
import StreakScreen from '../screens/StreakScreen';
import WithdrawalScreen from '../screens/WithdrawalScreen';
import OffersScreen from '../screens/OffersScreen';
import InviteScreen from '../screens/InviteScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Game" component={GameScreen} />
      <HomeStack.Screen name="SpecialOffer" component={SpecialOfferScreen} />
      <HomeStack.Screen name="Verify" component={VerifyScreen} />
      <HomeStack.Screen name="Streak" component={StreakScreen} />
      <HomeStack.Screen name="Withdrawal" component={WithdrawalScreen} />
      <HomeStack.Screen name="Offers" component={OffersScreen} />
    </HomeStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#5A6A82',
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            HomeTab: 'home',
            InviteTab: 'gift',
            BoardTab: 'bar-chart',
            ProfileTab: 'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="InviteTab" component={InviteScreen} options={{ title: 'Invite' }} />
      <Tab.Screen name="BoardTab" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ isAuthenticated }) {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
