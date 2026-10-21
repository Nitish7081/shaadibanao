import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { InterestsScreen } from '../screens/InterestsScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { AstrologyScreen } from '../screens/AstrologyScreen';
import { MeScreen } from '../screens/MeScreen';
import { ApprovalPendingScreen } from '../screens/ApprovalPendingScreen';
import { RoyalTabBar } from '../components/royal/RoyalTabBar';
import { getSessionUser, onUserUpdated } from '../services/authSession';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC<any> = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState(getSessionUser());

  useEffect(() => {
    const unsubscribe = onUserUpdated((updatedUser) => {
      setCurrentUser(updatedUser);
    });
    return unsubscribe;
  }, []);

  // Strict client-side guard: unapproved users cannot access tabs
  if (currentUser?.approvalStatus && currentUser.approvalStatus !== 'approved') {
    return <ApprovalPendingScreen navigation={navigation} route={{} as any} />;
  }

  return (
    <Tab.Navigator
      tabBar={(props) => <RoyalTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Matches" component={InterestsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Astrology" component={AstrologyScreen} />
      <Tab.Screen name="Profile" component={MeScreen} />
    </Tab.Navigator>
  );
};
