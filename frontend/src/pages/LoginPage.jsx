import './LoginPage.css';
import { auth, googleProvider } from '../config/firebase'; // Import from firebase.js
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("Successfully logged in:", user.displayName);
      
      // Extract user profile data
      const userProfile = {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      };
      console.log("User Profile:", userProfile);

      // Store user profile in localStorage for the homepage to access
      localStorage.setItem('userProfile', JSON.stringify(userProfile));

      // Redirect to homepage
      navigate('/');
    } catch (error) {
      console.error("Google Sign-In Error:", error.message);
      alert("Failed to sign in with Google. Please try again.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleGoogleLogin();
    }
  };

  return (
    <div className="login-container">
      <div className="login glass">
        <h2>👓 Vision Talk</h2>
        <button
          onClick={handleGoogleLogin}
          onKeyDown={handleKeyDown}
          className="google-login glass"
          aria-label="Sign in with Google"
        >
          🔐 Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default LoginPage;