import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { auth } from '../config/firebase'; // Import Firebase auth
import { signOut } from 'firebase/auth';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();

  // Load user profile from localStorage and keep it in sync with Firebase auth state
  useEffect(() => {
    const storedProfile = JSON.parse(localStorage.getItem('userProfile'));
    setUserProfile(storedProfile);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const profile = {
          displayName: user.displayName || 'Anonymous',
          email: user.email || '',
          photoURL: user.photoURL,
        };
        console.log('User Profile from Firebase:', profile); // Debug log
        setUserProfile(profile);
        localStorage.setItem('userProfile', JSON.stringify(profile));
      } else {
        setUserProfile(null);
        localStorage.removeItem('userProfile');
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    setDropdownOpen(false); // Close dropdown when toggling main menu
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('style', 'position: absolute; left: -9999px;');
    liveRegion.textContent = menuOpen ? 'Menu closed' : 'Menu opened';
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('style', 'position: absolute; left: -9999px;');
    liveRegion.textContent = dropdownOpen ? 'Profile dropdown closed' : 'Profile dropdown opened';
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  };

  const handleKeyDownMenu = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu();
    }
  };

  const handleKeyDownDropdown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      localStorage.removeItem('userProfile');
      setDropdownOpen(false);
      setMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error("Logout Error:", error.message);
      alert("Failed to log out. Please try again.");
    }
  };

  const handleImageError = (e) => {
    e.target.src = '/default-profile.png'; // Ensure fallback image loads
  };

  return (
    <nav className="navbar glass" role="navigation" aria-label="Main navigation">
      <h2 className="logo">Vision Talk</h2>
      <div
        className="hamburger"
        onClick={toggleMenu}
        onKeyDown={handleKeyDownMenu}
        tabIndex="0"
        role="button"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        ☰
      </div>
      <ul className={`nav-links ${menuOpen ? 'active' : ''}`}>
        <li><Link to="/" onClick={toggleMenu} tabIndex="0">Home</Link></li>
        <li><Link to="/chat" onClick={toggleMenu} tabIndex="0">Chat</Link></li>
        <li><Link to="/detect" onClick={toggleMenu} tabIndex="0">Detect</Link></li>
        {userProfile ? (
          <li className="profile-container">
            <div
              className="profile-circle"
              onClick={toggleDropdown}
              onKeyDown={handleKeyDownDropdown}
              tabIndex="0"
              role="button"
              aria-label="User profile menu"
              aria-expanded={dropdownOpen}
            >
              <img
                src={userProfile.photoURL || '/default-profile.png'}
                alt="User profile"
                className="profile-pic"
                onError={handleImageError}
              />
            </div>
            {dropdownOpen && (
              <div className="profile-dropdown glass">
                <div className="profile-info">
                  <img
                    src={userProfile.photoURL || '/default-profile.png'}
                    alt="User profile"
                    className="profile-pic-dropdown"
                    onError={handleImageError}
                  />
                  <div>
                    <p className="profile-name">{userProfile.displayName}</p>
                    <p className="profile-email">{userProfile.email}</p>
                  </div>
                </div>
                <Link to="/settings" onClick={() => { toggleDropdown(); toggleMenu(); }} className="dropdown-link">
                  Settings
                </Link>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            )}
          </li>
        ) : (
          <>
            <li><Link to="/login" onClick={toggleMenu} tabIndex="0">Login</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;