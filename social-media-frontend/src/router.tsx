import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { Layout } from './components/common/Layout/Layout';
import { PageLoader } from './components/common/Loading/PageLoader';

// Lazy load pages
const HomePage = lazy(() => import('@pages/Home/HomePage'));
const ExplorePage = lazy(() => import('@pages/Explore/ExplorePage'));
const ProfilePage = lazy(() => import('@pages/Profile/ProfilePage'));
const PostDetailPage = lazy(() => import('@pages/Post/PostDetailPage'));
const NotificationsPage = lazy(() => import('@pages/Notifications/NotificationsPage'));
const MessagesPage = lazy(() => import('@pages/Messages/MessagesPage'));
const SearchPage = lazy(() => import('@pages/Search/SearchPage'));
const SettingsPage = lazy(() => import('@pages/Settings/SettingsPage'));
const LoginPage = lazy(() => import('@pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('@pages/Auth/RegisterPage'));
const MFAPage = lazy(() => import('@pages/Auth/MFAPage'));
const ForgotPasswordPage = lazy(() => import('@pages/Auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@pages/Auth/ResetPasswordPage'));

export const Router = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/mfa" element={<MFAPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/p/:postId" element={<PostDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};