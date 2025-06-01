import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from 'firebase/auth'; // Updated imports
import { getFirestore, doc, addDoc, getDocs, updateDoc, collection, query, where, Timestamp, serverTimestamp, orderBy, limit, writeBatch, deleteDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { PlusCircle, BookOpen, BarChart3, LogOut, Brain, Trash2, Edit3, Layers, Shuffle, Printer, Sun, Moon, Type, Sparkles, Loader2, ListChecks, X, Check, Minus, Plus, UserPlus, LogIn } from 'lucide-react'; // Added UserPlus, LogIn

// --- Theme Context ---
const ThemeContext = createContext();
const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
    MINIMALIST: 'minimalist',
};

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('vocabAppTheme');
        return savedTheme && Object.values(THEMES).includes(savedTheme) ? savedTheme : THEMES.DARK;
    });

    useEffect(() => {
        localStorage.setItem('vocabAppTheme', theme);
        document.documentElement.classList.remove(THEMES.DARK, THEMES.LIGHT, THEMES.MINIMALIST);
        document.documentElement.classList.add(theme);
        if (theme === THEMES.MINIMALIST) {
            document.documentElement.classList.add('font-mono'); 
        } else {
            document.documentElement.classList.remove('font-mono');
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

const useTheme = () => useContext(ThemeContext);

// --- Firebase Configuration ---
const firebaseConfig = { // Make sure this is YOUR actual Firebase config
  apiKey: "AIzaSyCf_c6Z4uAPkYx3cXt9XZk-3-xWN3rtvyY",
  authDomain: "tongulos.firebaseapp.com",
  projectId: "tongulos",
  storageBucket: "tongulos.firebasestorage.app",
  messagingSenderId: "334130543480",
  appId: "1:334130543480:web:a60e06c125ea396494a68d",
  measurementId: "G-E55HFTTZ5Z"
};

// --- App ID ---
const appId = 'anki-vocab-app-default'; // You can customize this if needed

// --- Initialize Firebase ---
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// --- SRS Configuration ---
const LEARNING_STEPS_MINUTES = [1, 10]; 
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_INTERVAL_DAYS = 4;
const RELEARNING_STEPS_MINUTES = [1]; 
const MIN_INTERVAL_DAYS_AFTER_LAPSE = 1;
const DEFAULT_EASE_FACTOR = 2.5;
const HARD_FACTOR_MULTIPLIER = 1.2;
const EASY_BONUS_MULTIPLIER = 1.3;

// --- Helper Functions ---
const addMinutesToDate = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const addDaysToDate = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60000);

const CardStatus = {
    NEW: 'NEW',
    LEARNING: 'LEARNING',
    REVIEW: 'REVIEW',
    LAPSED: 'LAPSED',
};

// --- Auth Page Component ---
function AuthPage({ setCurrentUser, setUserIdToUse }) {
    const { theme } = useTheme();
    const [isSignUp, setIsSignUp] = useState(false); // To toggle between Sign In and Sign Up
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const inputBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300 text-gray-800' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400 text-black' : 'bg-slate-700 border-slate-600 text-slate-100';
    const buttonPrimaryClass = theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white';
    const buttonLinkClass = theme === THEMES.MINIMALIST ? 'text-sky-600 hover:text-sky-700' : 'text-sky-400 hover:text-sky-300';


    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isSignUp) {
            if (password !== confirmPassword) {
                setError("Passwords do not match!");
                setLoading(false);
                return;
            }
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // User will be set by onAuthStateChanged in App component
                // console.log("Signed up:", userCredential.user);
            } catch (err) {
                setError(err.message);
            }
        } else { // Sign In
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // User will be set by onAuthStateChanged in App component
                // console.log("Signed in:", userCredential.user);
            } catch (err) {
                setError(err.message);
            }
        }
        setLoading(false);
    };
    
    const getFriendlyErrorMessage = (firebaseError) => {
        if (!firebaseError) return '';
        switch (firebaseError.code || firebaseError) { // Check error.code if available
            case 'auth/invalid-email': return 'Please enter a valid email address.';
            case 'auth/user-not-found': return 'No account found with this email. Please sign up.';
            case 'auth/wrong-password': return 'Incorrect password. Please try again.';
            case 'auth/email-already-in-use': return 'This email is already registered. Please sign in or use a different email.';
            case 'auth/weak-password': return 'Password should be at least 6 characters long.';
            default: return firebaseError.message || 'An unexpected error occurred. Please try again.';
        }
    };


    return (
        <div className={`flex items-center justify-center min-h-screen`}>
            <div className={`${cardBgClass} p-8 rounded-xl shadow-2xl w-full max-w-md`}>
                <h2 className={`text-3xl font-bold text-center mb-6 ${headerTextClass}`}>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                </h2>
                <form onSubmit={handleAuthAction} className="space-y-6">
                    <div>
                        <label htmlFor="email" className={`block text-sm font-medium ${textClass} mb-1`}>Email Address</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`w-full p-3 ${inputBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`} />
                    </div>
                    <div>
                        <label htmlFor="password" className={`block text-sm font-medium ${textClass} mb-1`}>Password</label>
                        <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={`w-full p-3 ${inputBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`} />
                    </div>
                    {isSignUp && (
                        <div>
                            <label htmlFor="confirmPassword" className={`block text-sm font-medium ${textClass} mb-1`}>Confirm Password</label>
                            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={`w-full p-3 ${inputBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`} />
                        </div>
                    )}
                    {error && <p className="text-sm text-red-500 text-center">{getFriendlyErrorMessage(error)}</p>}
                    <button type="submit" disabled={loading} className={`w-full flex items-center justify-center p-3 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md disabled:opacity-70`}>
                        {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : (isSignUp ? <UserPlus size={20} className="mr-2"/> : <LogIn size={20} className="mr-2"/>)}
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>
                <p className={`mt-6 text-center text-sm ${textClass}`}>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className={`font-medium ${buttonLinkClass} hover:underline`}>
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
}


// --- Main App Component ---
function App() {
    const { theme, setTheme } = useTheme();
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false); // Tracks if onAuthStateChanged has run at least once
    const [activeTab, setActiveTab] = useState('decks'); 
    const [decks, setDecks] = useState([]);
    const [selectedDeckId, setSelectedDeckId] = useState(null);
    const [isLoadingDecks, setIsLoadingDecks] = useState(true);
    const [practiceModeActive, setPracticeModeActive] = useState(false);
    const [managingCardsDeckId, setManagingCardsDeckId] = useState(null); 

    const decksCollectionPath = userId ? `artifacts/${appId}/users/${userId}/decks` : null;

    useEffect(() => {
        if (!userId || !decksCollectionPath) {
            setDecks([]);
            setSelectedDeckId(null); 
            setIsLoadingDecks(false);
            return;
        }
        setIsLoadingDecks(true);
        const q = query(collection(db, decksCollectionPath), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedDecks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDecks(fetchedDecks);
            if (selectedDeckId && !fetchedDecks.some(deck => deck.id === selectedDeckId)) {
                setSelectedDeckId(null);
            }
            if (managingCardsDeckId && !fetchedDecks.some(deck => deck.id === managingCardsDeckId)) {
                setManagingCardsDeckId(null); 
            }
            setIsLoadingDecks(false);
        }, (error) => {
            console.error("Error fetching decks:", error);
            setIsLoadingDecks(false);
        });
        return () => unsubscribe();
    }, [userId, decksCollectionPath, selectedDeckId, managingCardsDeckId]);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
                console.log("User signed in:", currentUser.uid, currentUser.email);
            } else {
                setUser(null);
                setUserId(null);
                console.log("User signed out or not logged in.");
            }
            setIsAuthReady(true); // Firebase has checked auth state
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            // User state will be cleared by onAuthStateChanged
            // Reset app state that depends on user
            setDecks([]);
            setSelectedDeckId(null);
            setPracticeModeActive(false);
            setManagingCardsDeckId(null);
            setActiveTab('decks'); 
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };
    
    const currentDeckName = decks.find(d => d.id === (managingCardsDeckId || selectedDeckId))?.name || "No Deck Selected";

    const bgClass = theme === THEMES.LIGHT ? 'bg-gray-100' : theme === THEMES.MINIMALIST ? 'bg-white' : 'bg-slate-900';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const subTextClass = theme === THEMES.LIGHT ? 'text-gray-500' : theme === THEMES.MINIMALIST ? 'text-gray-700' : 'text-slate-400';
    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const navBgClass = theme === THEMES.LIGHT ? 'bg-gray-200' : theme === THEMES.MINIMALIST ? 'bg-gray-100 border border-gray-300' : 'bg-slate-800';
    const buttonHoverBgClass = theme === THEMES.MINIMALIST ? 'hover:bg-gray-200' : 'hover:bg-sky-700';


    if (!isAuthReady) { // Show a general loading screen while Firebase checks auth state
        return (
            <div className={`flex items-center justify-center min-h-screen ${bgClass} ${textClass}`}>
                <Brain className={`animate-pulse w-16 h-16 ${headerTextClass}`} />
                <p className="ml-4 text-xl">Initializing App...</p>
            </div>
        );
    }
    
    if (!user) { // If auth is ready and there's no user, show AuthPage
         return (
            <div className={`${bgClass} ${textClass}`}> {/* Apply theme to full auth page background */}
                <AuthPage />
            </div>
         );
    }


    const navigateToTab = (tab, deckId = null) => {
        setPracticeModeActive(false); 
        setManagingCardsDeckId(null); 
        if (deckId) {
            setSelectedDeckId(deckId);
        }
        setActiveTab(tab);
    }
    
    const startPracticeMode = (deckId) => {
        setSelectedDeckId(deckId);
        setManagingCardsDeckId(null);
        setPracticeModeActive(true);
        setActiveTab('practice'); 
    }

    const startManagingCards = (deckId) => {
        setPracticeModeActive(false);
        setManagingCardsDeckId(deckId);
        setSelectedDeckId(deckId); 
        setActiveTab('manage_cards');
    }


    return (
        <div className={`min-h-screen ${bgClass} ${textClass} flex flex-col items-center p-4`}>
            <header className="w-full max-w-3xl mb-6">
                <div className="flex justify-between items-center">
                     <div className="flex items-center">
                        <Layers className={`w-10 h-10 ${headerTextClass} mr-3`} />
                        <h1 className={`text-3xl font-bold ${headerTextClass}`}>VocabLearner SRS</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`p-1 rounded-md ${theme === THEMES.MINIMALIST ? 'border border-gray-400' : cardBgClass}`}>
                            <button onClick={() => setTheme(THEMES.LIGHT)} title="Light Mode" className={`p-1.5 rounded ${theme === THEMES.LIGHT ? (theme === THEMES.MINIMALIST ? 'bg-gray-300' : 'bg-sky-500') : ''} ${theme === THEMES.MINIMALIST ? 'text-black hover:bg-gray-200' : 'text-slate-300 hover:bg-slate-700'}`}> <Sun size={18}/> </button>
                            <button onClick={() => setTheme(THEMES.DARK)} title="Dark Mode" className={`p-1.5 rounded ${theme === THEMES.DARK ? 'bg-sky-500' : ''} ${theme === THEMES.MINIMALIST ? 'text-black hover:bg-gray-200' : 'text-slate-300 hover:bg-slate-700'}`}> <Moon size={18}/> </button>
                            <button onClick={() => setTheme(THEMES.MINIMALIST)} title="Minimalist Mode" className={`p-1.5 rounded ${theme === THEMES.MINIMALIST ? 'bg-gray-300' : ''} ${theme === THEMES.MINIMALIST ? 'text-black hover:bg-gray-200' : 'text-slate-300 hover:bg-slate-700'}`}> <Type size={18}/> </button>
                        </div>
                        {user && user.email && <span className={`text-xs ${subTextClass} hidden sm:block`}>{user.email}</span>}
                         <button onClick={handleSignOut} title="Sign Out" className={`p-2 rounded-md ${buttonHoverBgClass} transition-colors`}>
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
                {user && user.email && <p className={`text-sm ${subTextClass} sm:hidden mt-1`}>{user.email}</p>}
                {selectedDeckId && activeTab !== 'decks' && !practiceModeActive && !managingCardsDeckId && (
                     <p className={`text-sm ${theme === THEMES.MINIMALIST ? 'text-sky-700' : 'text-sky-300'} mt-1`}>Current Deck: {currentDeckName}</p>
                )}
                 {practiceModeActive && selectedDeckId && (
                     <p className={`text-sm ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'} mt-1`}>Practice Mode: {currentDeckName}</p>
                )}
                {managingCardsDeckId && (
                    <p className={`text-sm ${theme === THEMES.MINIMALIST ? 'text-indigo-700' : 'text-indigo-400'} mt-1`}>Managing Cards for: {currentDeckName}</p>
                )}
            </header>

            <nav className="w-full max-w-3xl mb-6">
                <div className={`flex space-x-1 sm:space-x-2 ${navBgClass} p-2 rounded-lg shadow-md`}>
                    {['decks', 'learn', 'add', 'stats'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => navigateToTab(tab, (tab !== 'decks' && selectedDeckId) ? selectedDeckId : null)}
                            disabled={(tab === 'learn' || tab === 'add' || tab === 'stats') && !selectedDeckId && decks.length > 0 && !practiceModeActive && !managingCardsDeckId}
                            className={`flex-1 py-2 px-2 sm:px-4 rounded-md text-xs sm:text-base font-medium transition-all duration-200 ease-in-out
                                ${activeTab === tab && !practiceModeActive && !managingCardsDeckId ? 
                                    (theme === THEMES.MINIMALIST ? 'bg-sky-300 text-black shadow-lg' : 'bg-sky-600 text-white shadow-lg') : 
                                    (theme === THEMES.MINIMALIST ? 'bg-gray-200 hover:bg-gray-300 text-black' : `bg-slate-700 ${buttonHoverBgClass} text-slate-300 hover:text-white`)}
                                ${((tab === 'learn' || tab === 'add' || tab === 'stats') && !selectedDeckId && decks.length > 0 && !practiceModeActive && !managingCardsDeckId) ? 'opacity-50 cursor-not-allowed' : ''}
                                ${practiceModeActive && activeTab === 'practice' && tab === 'learn' ? (theme === THEMES.MINIMALIST ? 'bg-amber-300 text-black shadow-lg' : 'bg-amber-600 text-white shadow-lg') : ''} 
                                ${managingCardsDeckId && activeTab === 'manage_cards' && tab === 'decks' ? (theme === THEMES.MINIMALIST ? 'bg-indigo-300 text-black shadow-lg' : 'bg-indigo-600 text-white shadow-lg') : ''}
                            `}
                        >
                            {tab === 'decks' && <Layers className="inline mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                            {tab === 'learn' && <BookOpen className="inline mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                            {tab === 'add' && <PlusCircle className="inline mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                            {tab === 'stats' && <BarChart3 className="inline mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
                 {(!selectedDeckId && decks.length > 0 && (activeTab === 'learn' || activeTab === 'add' || activeTab === 'stats') && !practiceModeActive && !managingCardsDeckId) && (
                    <p className={`text-center ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'} text-sm mt-2`}>Please select a deck from the 'Decks' tab to proceed.</p>
                )}
            </nav>

            <main className="w-full max-w-3xl">
                {isAuthReady && userId && ( // Ensure userId is present before rendering main content
                    <>
                        {activeTab === 'decks' && !practiceModeActive && !managingCardsDeckId && <DecksManager userId={userId} decks={decks} setSelectedDeckId={setSelectedDeckId} navigateToTab={navigateToTab} startPracticeMode={startPracticeMode} startManagingCards={startManagingCards} isLoadingDecks={isLoadingDecks} />}
                        {activeTab === 'add' && selectedDeckId && !practiceModeActive && !managingCardsDeckId && <AddCard userId={userId} selectedDeckId={selectedDeckId} decks={decks} setActiveTab={setActiveTab} setSelectedDeckId={setSelectedDeckId} isLoadingDecks={isLoadingDecks} />}
                        {activeTab === 'learn' && selectedDeckId && !practiceModeActive && !managingCardsDeckId && <Learner userId={userId} selectedDeckId={selectedDeckId} />}
                        {activeTab === 'stats' && selectedDeckId && !practiceModeActive && !managingCardsDeckId && <Stats userId={userId} selectedDeckId={selectedDeckId} />}
                        {practiceModeActive && selectedDeckId && activeTab === 'practice' && <PracticeReviewer userId={userId} selectedDeckId={selectedDeckId} deckName={currentDeckName} exitPracticeMode={() => { setPracticeModeActive(false); setActiveTab('decks'); }} />}
                        {managingCardsDeckId && activeTab === 'manage_cards' && <ManageCardsView userId={userId} deckId={managingCardsDeckId} deckName={currentDeckName} navigateToTab={navigateToTab} exitManageView={() => { setManagingCardsDeckId(null); setActiveTab('decks');}} />}


                        {(activeTab === 'add' || activeTab === 'learn' || activeTab === 'stats') && !selectedDeckId && decks.length === 0 && !isLoadingDecks && !practiceModeActive && !managingCardsDeckId && (
                             <div className={`text-center p-8 ${cardBgClass} rounded-lg shadow-xl`}>
                                <p className={`text-xl ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'}`}>No decks found.</p>
                                <button onClick={() => setActiveTab('decks')} className={`mt-4 px-4 py-2 ${theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white'} rounded-lg`}>Go to Decks to create one</button>
                            </div>
                        )}
                    </>
                )}
            </main>
            <footer className={`mt-12 text-center text-xs ${subTextClass}`}>
                <p>&copy; {new Date().getFullYear()} VocabLearner SRS. Inspired by Anki.</p>
                <p>App ID: {appId}</p>
            </footer>
        </div>
    );
}


// --- DecksManager Component ---
function DecksManager({ userId, decks, setSelectedDeckId, navigateToTab, startPracticeMode, startManagingCards, isLoadingDecks }) {
    const { theme } = useTheme();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingDeckId, setEditingDeckId] = useState(null); 
    const [deckNameInput, setDeckNameInput] = useState(''); 
    const [deckName, setDeckName] = useState(''); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); 
    const [showExportMessage, setShowExportMessage] = useState('');
    const [showGenerateDeckModal, setShowGenerateDeckModal] = useState(false);

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const itemBgClass = theme === THEMES.LIGHT ? 'bg-gray-50' : theme === THEMES.MINIMALIST ? 'bg-white border border-gray-200' : 'bg-slate-700';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const subTextClass = theme === THEMES.LIGHT ? 'text-gray-500' : theme === THEMES.MINIMALIST ? 'text-gray-700' : 'text-slate-400';
    const inputBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400' : 'bg-slate-700 border-slate-600';
    const buttonPrimaryClass = theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white';
    const buttonSecondaryClass = theme === THEMES.MINIMALIST ? 'bg-gray-200 hover:bg-gray-300 text-black' : 'bg-slate-600 hover:bg-slate-500 text-white';
    const buttonDangerClass = theme === THEMES.MINIMALIST ? 'bg-red-200 hover:bg-red-300 text-black' : 'bg-red-600 hover:bg-red-500 text-white';
    const buttonWarningClass = theme === THEMES.MINIMALIST ? 'bg-amber-200 hover:bg-amber-300 text-black' : 'bg-amber-500 hover:bg-amber-400 text-white';
    const buttonTealClass = theme === THEMES.MINIMALIST ? 'bg-teal-200 hover:bg-teal-300 text-black' : 'bg-teal-500 hover:bg-teal-400 text-white';
    const geminiButtonClass = theme === THEMES.MINIMALIST ? 'bg-purple-200 hover:bg-purple-300 text-black' : 'bg-purple-600 hover:bg-purple-500 text-white';


    const handleDeckNameClick = (deck) => {
        setEditingDeckId(deck.id);
        setDeckNameInput(deck.name);
    };

    const handleDeckNameChange = (e) => {
        setDeckNameInput(e.target.value.slice(0, 20)); 
    };

    const saveDeckName = async (deckId) => {
        const trimmedName = deckNameInput.trim();
        if (!trimmedName) {
            const originalDeck = decks.find(d => d.id === deckId);
            if (originalDeck) setDeckNameInput(originalDeck.name); 
            setEditingDeckId(null);
            return;
        }
        setIsSubmitting(true);
        const currentDecksCollectionPath = `artifacts/${appId}/users/${userId}/decks`;
        const deckRef = doc(db, currentDecksCollectionPath, deckId);
        try {
            await updateDoc(deckRef, { name: trimmedName.slice(0,20), updatedAt: serverTimestamp() });
            setEditingDeckId(null);
        } catch (error) {
            console.error("Error updating deck name:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeckNameBlur = (deckId) => {
        saveDeckName(deckId); 
    };
    
    const handleDeckNameKeyDown = (e, deckId) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            saveDeckName(deckId);
        } else if (e.key === 'Escape') {
            const originalDeck = decks.find(d => d.id === deckId);
            if (originalDeck) setDeckNameInput(originalDeck.name);
            setEditingDeckId(null);
        }
    };


    const handleCreateDeckViaModal = async (e) => { 
        e.preventDefault();
        if (!deckName.trim()) return; 
        setIsSubmitting(true);
        try {
            const currentDecksCollectionPath = `artifacts/${appId}/users/${userId}/decks`;
            if (!userId || !currentDecksCollectionPath) {
                console.error("User ID or deck path is invalid for create/update.");
                setIsSubmitting(false);
                return;
            }
            await addDoc(collection(db, currentDecksCollectionPath), {
                name: deckName.trim().slice(0,20), 
                userId: userId,
                createdAt: serverTimestamp(),
            });
            setDeckName(''); 
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error saving deck:", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteDeck = async (deckIdConfirmed) => {
        if (!showDeleteConfirm || showDeleteConfirm !== deckIdConfirmed) {
             return;
        }
        if (!deckIdConfirmed || !userId) { 
            console.error("Deck ID or User ID is undefined for deletion.");
            setIsSubmitting(false);
            return;
        }

        setIsSubmitting(true);
        
        const currentDecksCollectionPath = `artifacts/${appId}/users/${userId}/decks`;
        const currentCardsCollectionPathRoot = `artifacts/${appId}/users/${userId}/vocabCards`;

        try {
            await runTransaction(db, async (transaction) => {
                const deckRef = doc(db, currentDecksCollectionPath, deckIdConfirmed);
                const cardsQuery = query(
                    collection(db, currentCardsCollectionPathRoot),
                    where('deckId', '==', deckIdConfirmed),
                    where('userId', '==', userId) 
                );
                
                const cardsSnapshot = await transaction.get(cardsQuery);
                
                cardsSnapshot.forEach((cardDoc) => { 
                    transaction.delete(cardDoc.ref);
                });
                transaction.delete(deckRef); 
            });

            if (setSelectedDeckId && typeof setSelectedDeckId === 'function') {
                 setSelectedDeckId(prevSelected => prevSelected === deckIdConfirmed ? null : prevSelected);
            }
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Error deleting deck and its cards:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportDeck = async (deckIdToExport, deckNameToExport) => {
        setShowExportMessage(`Exporting "${deckNameToExport}"...`);
        const currentCardsCollectionPathRoot = `artifacts/${appId}/users/${userId}/vocabCards`;
        try {
            const cardsQuery = query(
                collection(db, currentCardsCollectionPathRoot),
                where('userId', '==', userId),
                where('deckId', '==', deckIdToExport)
            );
            const querySnapshot = await getDocs(cardsQuery);
            const cardsToExport = querySnapshot.docs.map(doc => doc.data());

            if (cardsToExport.length === 0) {
                setShowExportMessage(`Deck "${deckNameToExport}" is empty. Nothing to export.`);
                setTimeout(() => setShowExportMessage(''), 3000);
                return;
            }

            let htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Exported Deck: ${deckNameToExport}</title>
                    <style>
                        body { font-family: ${theme === THEMES.MINIMALIST ? 'monospace' : 'Arial, sans-serif'}; margin: 20px; background-color: #fff; color: #000; font-size: 12pt; }
                        h1 { color: #000; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;}
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; word-wrap: break-word; }
                        th { background-color: #eee; }
                        .controls { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
                        .controls button { margin: 0 5px; padding: 8px 12px; font-size: 10pt; cursor: pointer; background-color: #ddd; border: 1px solid #bbb; border-radius: 4px; }
                        .controls span { margin: 0 5px; }
                        @media print {
                            @page { size: A4; margin: 15mm; }
                            body { font-size: 10pt; } 
                            .no-print { display: none; }
                            table { margin-top: 10px; }
                            th, td { padding: 4px 8px; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Deck: ${deckNameToExport}</h1>
                    <div class="controls no-print">
                        <span>Font Size:</span> 
                        <button onclick="changeFontSize(-1)">-</button>
                        <span id="currentFontSize">12</span>pt
                        <button onclick="changeFontSize(1)">+</button>
                        <button class="print-button" onclick="window.print()" style="margin-left: 20px; background-color: #007bff; color:white;">Print Practice Sheet</button>
                    </div>
                    <table id="cardsTable">
                        <thead>
                            <tr>
                                <th style="width:50%;">Front (Word/Phrase)</th>
                                <th style="width:50%;">Back (Definition/Translation)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            cardsToExport.forEach(card => {
                htmlContent += `
                    <tr>
                        <td>${card.front.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                        <td>${card.back.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                    </tr>
                `;
            });
            htmlContent += `
                        </tbody>
                    </table>
                    <script>
                        let currentFontSize = 12;
                        function changeFontSize(amount) {
                            currentFontSize += amount;
                            if (currentFontSize < 6) currentFontSize = 6;
                            if (currentFontSize > 24) currentFontSize = 24;
                            const table = document.getElementById('cardsTable');
                            if(table) table.style.fontSize = currentFontSize + 'pt';
                            const fontSizeDisplay = document.getElementById('currentFontSize');
                            if(fontSizeDisplay) fontSizeDisplay.innerText = currentFontSize;
                        }
                    </script>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                setShowExportMessage('Could not open new window for export. Please check your popup blocker settings.');
            }
            setShowExportMessage(''); 
        } catch (error) {
            console.error("Error exporting deck:", error);
            setShowExportMessage(`Error exporting "${deckNameToExport}". Please try again.`);
            setTimeout(() => setShowExportMessage(''), 3000);
        }
    };


    if (isLoadingDecks) {
        return <div className="text-center p-10"><Brain className={`animate-pulse w-12 h-12 ${headerTextClass} mx-auto mb-4`} /><p className={`${textClass}`}>Loading Decks...</p></div>;
    }

    return (
        <div className={`${cardBgClass} p-6 sm:p-8 rounded-xl shadow-2xl`}>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-3 sm:space-y-0">
                <h2 className={`text-2xl font-semibold ${headerTextClass} flex items-center`}>
                    <Layers className={`mr-3 ${headerTextClass}`} size={28} /> Your Decks
                </h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setShowGenerateDeckModal(true)}
                        className={`px-4 py-2 ${geminiButtonClass} font-semibold rounded-lg shadow-md flex items-center text-sm sm:text-base`}
                    >
                        <Sparkles size={20} className="mr-2" /> Generate Deck
                    </button>
                    <button
                        onClick={() => { setDeckName(''); setShowCreateModal(true); }} 
                        className={`px-4 py-2 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md flex items-center text-sm sm:text-base`}
                    >
                        <PlusCircle size={20} className="mr-2" /> Create Deck
                    </button>
                </div>
            </div>

            {showExportMessage && <p className={`text-center ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'} my-2`}>{showExportMessage}</p>}

            {decks.length === 0 && !isLoadingDecks && (
                <p className={`text-center ${subTextClass} py-8`}>No decks created yet. Click "Create Deck" or "Generate Deck" to get started!</p>
            )}

            <div className="space-y-3">
                {decks.map(deck => (
                    <div key={deck.id} className={`${itemBgClass} p-3 sm:p-4 rounded-lg shadow flex flex-col sm:flex-row justify-between items-start sm:items-center`}>
                        {editingDeckId === deck.id ? (
                            <input
                                type="text"
                                value={deckNameInput}
                                onChange={handleDeckNameChange}
                                onBlur={() => handleDeckNameBlur(deck.id)}
                                onKeyDown={(e) => handleDeckNameKeyDown(e, deck.id)}
                                className={`text-lg ${inputBgClass} ${textClass} font-medium p-1 border rounded-md w-full sm:w-auto focus:ring-2 focus:ring-sky-500`}
                                autoFocus
                                maxLength={20}
                            />
                        ) : (
                            <span 
                                className={`text-lg ${textClass} font-medium break-all mb-2 sm:mb-0 cursor-pointer hover:underline`}
                                onClick={() => handleDeckNameClick(deck)}
                            >
                                {deck.name}
                            </span>
                        )}
                        <div className="flex gap-1 sm:gap-2 flex-wrap justify-start sm:justify-center mt-2 sm:mt-0"> 
                            <button onClick={() => { setSelectedDeckId(deck.id); navigateToTab('learn', deck.id); }} className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm ${buttonPrimaryClass} rounded-md flex items-center`}><BookOpen size={16} className="mr-1"/>Learn</button>
                            <button onClick={() => startPracticeMode(deck.id)} className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm ${buttonWarningClass} rounded-md flex items-center`}><Shuffle size={16} className="mr-1"/>Practice</button>
                            <button onClick={() => startManagingCards(deck.id)} className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm ${theme === THEMES.MINIMALIST ? 'bg-indigo-200 hover:bg-indigo-300 text-black' : 'bg-indigo-500 hover:bg-indigo-400 text-white'} rounded-md flex items-center`}><ListChecks size={16} className="mr-1"/>Manage Cards</button>
                            <button onClick={() => handleExportDeck(deck.id, deck.name)} className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm ${buttonTealClass} rounded-md flex items-center`}><Printer size={16} className="mr-1"/>Export</button>
                            <button onClick={() => setShowDeleteConfirm(deck.id)} className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm ${buttonDangerClass} rounded-md flex items-center`}><Trash2 size={16} className="mr-1"/>Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {showCreateModal && ( 
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
                    <div className={`${cardBgClass} p-6 rounded-lg shadow-xl w-full max-w-md`}>
                        <h3 className={`text-xl font-semibold mb-4 ${headerTextClass}`}>Create New Deck</h3>
                        <form onSubmit={handleCreateDeckViaModal}> 
                            <input
                                type="text"
                                value={deckName} 
                                onChange={(e) => setDeckName(e.target.value.slice(0, 20))} 
                                placeholder="Deck Name (max 20 chars)"
                                className={`w-full p-3 ${inputBgClass} ${textClass} rounded-lg focus:ring-2 focus:ring-sky-500 mb-4`}
                                autoFocus
                                maxLength={20}
                            />
                            <div className="flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowCreateModal(false)} className={`px-4 py-2 ${buttonSecondaryClass} rounded-lg`}>Cancel</button>
                                <button type="submit" disabled={isSubmitting} className={`px-4 py-2 ${buttonPrimaryClass} rounded-lg disabled:opacity-50`}>
                                    {isSubmitting ? 'Creating...' : 'Create Deck'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showDeleteConfirm && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className={`${cardBgClass} p-6 rounded-lg shadow-xl w-full max-w-md`}>
                        <h3 className={`text-xl font-semibold mb-2 ${theme === THEMES.MINIMALIST ? 'text-red-700' : 'text-red-400'}`}>Confirm Deletion</h3>
                        <p className={`${textClass} mb-4`}>Are you sure you want to delete the deck "<strong>{decks.find(d=>d.id === showDeleteConfirm)?.name}</strong>"? This will also delete all cards within this deck. This action cannot be undone.</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`px-4 py-2 ${buttonSecondaryClass} rounded-lg`}>Cancel</button>
                            <button onClick={() => handleDeleteDeck(showDeleteConfirm)} disabled={isSubmitting} className={`px-4 py-2 ${buttonDangerClass} rounded-lg disabled:opacity-50`}>
                                {isSubmitting ? 'Deleting...' : 'Delete Deck'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showGenerateDeckModal && <GenerateDeckModal userId={userId} onClose={() => setShowGenerateDeckModal(false)} />}
        </div>
    );
}

// --- GenerateDeckModal Component ---
function GenerateDeckModal({ userId, onClose }) { 
    const { theme } = useTheme();
    const [userInput, setUserInput] = useState('');
    const [newDeckName, setNewDeckName] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationMessage, setGenerationMessage] = useState('');
    const [generatedCards, setGeneratedCards] = useState([]); 

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-purple-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-purple-400';
    const inputBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400' : 'bg-slate-700 border-slate-600';
    const buttonPrimaryClass = theme === THEMES.MINIMALIST ? 'bg-purple-200 hover:bg-purple-300 text-black' : 'bg-purple-600 hover:bg-purple-500 text-white';
    const buttonSecondaryClass = theme === THEMES.MINIMALIST ? 'bg-gray-200 hover:bg-gray-300 text-black' : 'bg-slate-600 hover:bg-slate-500 text-white';

    const handleGenerateCardsFromGemini = async () => {
        if (!userInput.trim()) {
            setGenerationMessage('Please enter a topic or your notes.');
            return;
        }
        setIsGenerating(true);
        setGenerationMessage('Generating cards with Gemini... this may take a moment.');
        setGeneratedCards([]);

        const prompt = `Based on the following input, generate a list of vocabulary flashcards. Each flashcard should have a "front" (word or short phrase) and a "back" (definition or explanation).
Input: "${userInput.trim()}"
Provide the output as a JSON array of objects, where each object has a "front" and "back" key. For example: [{"front": "Apple", "back": "A common fruit"}, {"front": "Banana", "back": "A yellow fruit"}]. Aim for around 10-50 cards if the topic is broad enough, or fewer if it's very specific. Ensure the JSON is valid.`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "front": { "type": "STRING" },
                            "back": { "type": "STRING" }
                        },
                        required: ["front", "back"]
                    }
                }
            }
        };
        const apiKey = ""; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Gemini API request failed with status ${response.status}`);
            }
            const result = await response.json();
            
            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0].text) {
                const jsonString = result.candidates[0].content.parts[0].text;
                const parsedCards = JSON.parse(jsonString);
                if (Array.isArray(parsedCards) && parsedCards.every(c => c.front && c.back)) {
                    setGeneratedCards(parsedCards);
                    setGenerationMessage(`Successfully generated ${parsedCards.length} cards! Please name your new deck and save.`);
                } else {
                    throw new Error("Gemini returned data not in the expected format (array of front/back objects).");
                }
            } else {
                throw new Error("No valid card data received from Gemini API.");
            }
        } catch (error) {
            console.error("Error generating deck with Gemini:", error);
            setGenerationMessage(`Failed to generate cards: ${error.message}. Please try a different input or check console.`);
            setGeneratedCards([]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveGeneratedDeck = async (e) => {
        e.preventDefault();
        if (!newDeckName.trim()) {
            setGenerationMessage('Please provide a name for the new deck.');
            return;
        }
        if (generatedCards.length === 0) {
            setGenerationMessage('No cards were generated. Please try generating again.');
            return;
        }
        if (!userId) { 
            setGenerationMessage('User not identified. Cannot save deck.');
            return;
        }
        setIsGenerating(true); 
        setGenerationMessage('Saving new deck and cards...');
        
        const currentDecksCollectionPath = `artifacts/${appId}/users/${userId}/decks`;
        const currentCardsCollectionPathRoot = `artifacts/${appId}/users/${userId}/vocabCards`;


        try {
            const deckRef = await addDoc(collection(db, currentDecksCollectionPath), {
                name: newDeckName.trim().slice(0,20), 
                userId: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            const newDeckId = deckRef.id;

            const batch = writeBatch(db);
            generatedCards.forEach(cardData => {
                const cardRef = doc(collection(db, currentCardsCollectionPathRoot)); 
                batch.set(cardRef, {
                    ...cardData,
                    deckId: newDeckId,
                    status: CardStatus.NEW,
                    due: Timestamp.now(),
                    intervalDays: 0,
                    easeFactor: DEFAULT_EASE_FACTOR,
                    learningStep: 0,
                    lapses: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    userId: userId,
                });
            });
            await batch.commit();
            setGenerationMessage(`Deck "${newDeckName.trim().slice(0,20)}" created with ${generatedCards.length} cards!`);
            setTimeout(() => {
                onClose(); 
            }, 2000);
        } catch (error) {
            console.error("Error saving generated deck:", error);
            setGenerationMessage('Error saving deck. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className={`${cardBgClass} p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-xl font-semibold ${headerTextClass}`}>✨ Generate New Deck with AI</h3>
                    <button onClick={onClose} className={`p-1 rounded-full hover:bg-opacity-20 ${theme === THEMES.MINIMALIST ? 'hover:bg-gray-300' : 'hover:bg-slate-600'}`}><X size={20}/></button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label htmlFor="userInput" className={`block text-sm font-medium ${textClass} mb-1`}>Topic or Notes for Deck Generation:</label>
                        <textarea
                            id="userInput"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="e.g., 'Basic Spanish Greetings', or paste your notes about photosynthesis here..."
                            rows="5"
                            className={`w-full p-3 ${inputBgClass} ${textClass} rounded-lg focus:ring-2 focus:ring-purple-500`}
                            disabled={isGenerating || generatedCards.length > 0}
                        />
                    </div>

                    {!generatedCards.length > 0 && (
                         <button
                            onClick={handleGenerateCardsFromGemini}
                            disabled={isGenerating || !userInput.trim()}
                            className={`w-full px-4 py-2 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md flex items-center justify-center disabled:opacity-60`}
                        >
                            {isGenerating ? <Loader2 size={20} className="animate-spin mr-2" /> : <Sparkles size={20} className="mr-2" />}
                            {isGenerating ? 'Generating Cards...' : 'Generate Cards from Input'}
                        </button>
                    )}

                    {generationMessage && <p className={`text-sm my-2 p-2 rounded ${generationMessage.includes('Failed') || generationMessage.includes('Error') ? (theme === THEMES.MINIMALIST ? 'bg-red-100 text-red-700' : 'bg-red-700 text-red-100') : (theme === THEMES.MINIMALIST ? 'bg-green-100 text-green-700' : 'bg-green-700 text-green-100')}`}>{generationMessage}</p>}
                
                    {generatedCards.length > 0 && (
                        <form onSubmit={handleSaveGeneratedDeck} className={`space-y-3 mt-4 border-t pt-4 ${theme === THEMES.MINIMALIST ? 'border-gray-300' : 'border-slate-700'}`}>
                             <div>
                                <label htmlFor="newDeckName" className={`block text-sm font-medium ${textClass} mb-1`}>Name for your New Deck (max 20 chars):</label>
                                <input
                                    type="text"
                                    id="newDeckName"
                                    value={newDeckName}
                                    onChange={(e) => setNewDeckName(e.target.value.slice(0, 20))}
                                    placeholder="e.g., My AI Spanish Deck"
                                    className={`w-full p-3 ${inputBgClass} ${textClass} rounded-lg focus:ring-2 focus:ring-purple-500`}
                                    required
                                    disabled={isGenerating}
                                    maxLength={20}
                                />
                            </div>
                            <p className={`${textClass} text-sm`}>Review generated cards ({generatedCards.length}):</p>
                            <div className={`max-h-48 overflow-y-auto border rounded p-2 ${theme === THEMES.MINIMALIST ? 'border-gray-300 bg-white' : 'border-slate-600 bg-slate-700'}`}>
                                {generatedCards.map((card, index) => (
                                    <div key={index} className={`p-1.5 text-xs ${theme === THEMES.MINIMALIST ? 'border-b border-gray-200' : 'border-b border-slate-600'} last:border-b-0`}>
                                        <strong>Front:</strong> {card.front} <br/>
                                        <strong>Back:</strong> {card.back}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="submit"
                                disabled={isGenerating || !newDeckName.trim()}
                                className={`w-full px-4 py-2 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md flex items-center justify-center disabled:opacity-60`}
                            >
                                {isGenerating ? <Loader2 size={20} className="animate-spin mr-2" /> : <PlusCircle size={20} className="mr-2" />}
                                {isGenerating ? 'Saving Deck...' : 'Save New Deck & Cards'}
                            </button>
                        </form>
                    )}
                </div>
                <div className={`mt-4 pt-4 border-t ${theme === THEMES.MINIMALIST ? 'border-gray-300' : 'border-slate-700'}`}>
                    <button onClick={onClose} className={`w-full px-4 py-2 ${buttonSecondaryClass} rounded-lg`}>Close</button>
                </div>

            </div>
        </div>
    );
}


// --- ManageCardsView Component ---
function ManageCardsView({ userId, deckId, deckName, exitManageView, navigateToTab }) { 
    const { theme } = useTheme();
    const [cards, setCards] = useState([]);
    const [isLoadingCards, setIsLoadingCards] = useState(true);
    const [editingCardId, setEditingCardId] = useState(null);
    const [cardFrontInput, setCardFrontInput] = useState('');
    const [cardBackInput, setCardBackInput] = useState('');
    const [isSubmittingCard, setIsSubmittingCard] = useState(false);
    const [message, setMessage] = useState('');

    const cardsCollectionPath = `artifacts/${appId}/users/${userId}/vocabCards`;

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const itemBgClass = theme === THEMES.LIGHT ? 'bg-gray-50' : theme === THEMES.MINIMALIST ? 'bg-white border border-gray-200' : 'bg-slate-700';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-indigo-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-indigo-400';
    const subTextClass = theme === THEMES.LIGHT ? 'text-gray-600' : theme === THEMES.MINIMALIST ? 'text-gray-700' : 'text-slate-300';
    const inputBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400' : 'bg-slate-700 border-slate-600';
    const buttonSecondaryClass = theme === THEMES.MINIMALIST ? 'bg-gray-200 hover:bg-gray-300 text-black' : 'bg-slate-600 hover:bg-slate-500 text-white';
    const addCardButtonClass = theme === THEMES.MINIMALIST ? 'bg-green-200 hover:bg-green-300 text-black' : 'bg-green-600 hover:bg-green-500 text-white';


    useEffect(() => {
        if (!userId || !deckId) {
            setIsLoadingCards(false);
            return;
        }
        setIsLoadingCards(true);
        const q = query(collection(db, cardsCollectionPath), where('userId', '==', userId), where('deckId', '==', deckId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetchedCards.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setCards(fetchedCards);
            setIsLoadingCards(false);
        }, (error) => {
            console.error("Error fetching cards for management:", error);
            setMessage({ type: 'error', text: 'Failed to load cards.' });
            setIsLoadingCards(false);
        });
        return () => unsubscribe();
    }, [userId, deckId, cardsCollectionPath]);

    const handleCardFieldClick = (card, field) => {
        setEditingCardId(card.id + '-' + field); 
        if (field === 'front') {
            setCardFrontInput(card.front);
        } else {
            setCardBackInput(card.back);
        }
    };

    const handleCardInputChange = (e, field) => {
        if (field === 'front') {
            setCardFrontInput(e.target.value);
        } else {
            setCardBackInput(e.target.value);
        }
    };
    
    const saveCardField = async (cardId, field) => {
        const cardToUpdate = cards.find(c => c.id === cardId);
        if (!cardToUpdate) return;

        let newContent = field === 'front' ? cardFrontInput.trim() : cardBackInput.trim();
        if (!newContent && field === 'front') { 
            newContent = cardToUpdate.front; 
        } else if (!newContent && field === 'back') {
            newContent = cardToUpdate.back; 
        }


        setIsSubmittingCard(true);
        setMessage('');
        try {
            const cardRef = doc(db, cardsCollectionPath, cardId);
            await updateDoc(cardRef, {
                [field]: newContent,
                updatedAt: serverTimestamp(),
            });
            setEditingCardId(null); 
        } catch (error) {
            console.error(`Error updating card ${field}:`, error);
            setMessage({ type: 'error', text: `Failed to update card ${field}.` });
        } finally {
            setIsSubmittingCard(false);
        }
    };

    const handleCardInputBlur = (cardId, field) => {
        saveCardField(cardId, field);
    };

    const handleCardInputKeyDown = (e, cardId, field) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            saveCardField(cardId, field);
        } else if (e.key === 'Escape') {
            setEditingCardId(null); 
            const originalCard = cards.find(c => c.id === cardId);
            if (originalCard) {
                if (field === 'front') setCardFrontInput(originalCard.front);
                else setCardBackInput(originalCard.back);
            }
        }
    };


    const handleDeleteCard = async (cardId) => {
        setIsSubmittingCard(true); 
        try {
            await deleteDoc(doc(db, cardsCollectionPath, cardId));
        } catch (error) {
            console.error("Error deleting card:", error);
            setMessage({ type: 'error', text: 'Failed to delete card.' });
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsSubmittingCard(false);
        }
    };
    
    if (isLoadingCards) {
        return <div className="text-center p-10"><Loader2 className={`animate-spin w-12 h-12 ${headerTextClass} mx-auto mb-4`} /><p className={`${textClass}`}>Loading Cards...</p></div>;
    }

    return (
        <div className={`${cardBgClass} p-4 sm:p-6 rounded-xl shadow-2xl`}>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-2">
                <h2 className={`text-xl sm:text-2xl font-semibold ${headerTextClass} flex items-center`}>
                    <ListChecks className={`mr-2 sm:mr-3 ${headerTextClass}`} size={28} /> Manage Cards in "{deckName}"
                </h2>
                <div className="flex space-x-2">
                    <button onClick={() => navigateToTab('add', deckId)} className={`px-3 py-1.5 sm:px-4 sm:py-2 ${addCardButtonClass} rounded-lg text-xs sm:text-sm flex items-center`}>
                        <PlusCircle size={16} className="mr-1.5"/> Add New Card
                    </button>
                    <button onClick={exitManageView} className={`px-3 py-1.5 sm:px-4 sm:py-2 ${buttonSecondaryClass} rounded-lg text-xs sm:text-sm`}>Back to Decks</button>
                </div>
            </div>

            {message.text && (
                <div className={`my-2 p-2 rounded-md text-xs sm:text-sm ${message.type === 'success' ? (theme === THEMES.MINIMALIST ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-green-700 text-green-100') : (theme === THEMES.MINIMALIST ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-red-700 text-red-100')}`}>
                    {message.text}
                </div>
            )}

            {cards.length === 0 && (
                <p className={`text-center ${subTextClass} py-6`}>This deck has no cards yet. Click "Add New Card" to start!</p>
            )}

            <div className="space-y-2 sm:space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {cards.map(card => (
                    <div key={card.id} className={`${itemBgClass} p-3 rounded-lg shadow flex items-start justify-between`}>
                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-4"> 
                            <div className="w-full">
                                <span className={`font-semibold ${textClass} text-xs`}>FRONT:</span>
                                {editingCardId === card.id + '-front' ? (
                                    <textarea
                                        value={cardFrontInput}
                                        onChange={(e) => handleCardInputChange(e, 'front')}
                                        onBlur={() => handleCardInputBlur(card.id, 'front')}
                                        onKeyDown={(e) => handleCardInputKeyDown(e, card.id, 'front')}
                                        className={`w-full p-1 mt-0.5 text-sm ${inputBgClass} ${textClass} rounded focus:ring-1 focus:ring-sky-500 min-h-[3em]`}
                                        rows="2"
                                        autoFocus
                                    />
                                ) : (
                                    <p onClick={() => handleCardFieldClick(card, 'front')} className={`${textClass} break-words cursor-pointer hover:bg-opacity-10 p-1 min-h-[2em] ${theme === THEMES.MINIMALIST ? 'hover:bg-gray-200' : 'hover:bg-slate-600'}`}>{card.front}</p>
                                )}
                            </div>
                            <div className="w-full mt-2 md:mt-0">
                                <span className={`font-semibold ${textClass} text-xs`}>BACK:</span>
                                {editingCardId === card.id + '-back' ? (
                                    <textarea
                                        value={cardBackInput}
                                        onChange={(e) => handleCardInputChange(e, 'back')}
                                        onBlur={() => handleCardInputBlur(card.id, 'back')}
                                        onKeyDown={(e) => handleCardInputKeyDown(e, card.id, 'back')}
                                        className={`w-full p-1 mt-0.5 text-sm ${inputBgClass} ${textClass} rounded focus:ring-1 focus:ring-sky-500 min-h-[3em]`}
                                        rows="3"
                                        autoFocus
                                    />
                                ) : (
                                    <p onClick={() => handleCardFieldClick(card, 'back')} className={`${textClass} break-words cursor-pointer hover:bg-opacity-10 p-1 min-h-[2em] ${theme === THEMES.MINIMALIST ? 'hover:bg-gray-200' : 'hover:bg-slate-600'}`}>{card.back}</p>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteCard(card.id)} 
                            className={`ml-2 p-1.5 self-center rounded-md ${theme === THEMES.MINIMALIST ? 'text-red-500 hover:bg-red-100' : 'text-red-400 hover:bg-red-700 hover:text-red-200'}`}
                            title="Delete Card"
                        >
                            <X size={18}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}


// --- AddCard Component ---
function AddCard({ userId, selectedDeckId, decks, setActiveTab, setSelectedDeckId, isLoadingDecks }) { 
    const { theme } = useTheme();
    const [front, setFront] = useState('');
    const [back, setBack] = useState('');
    const [currentSelectedDeckId, setCurrentSelectedDeckId] = useState(selectedDeckId);
    const [isLoading, setIsLoading] = useState(false); 
    const [message, setMessage] = useState('');
    const cardsCollectionPath = `artifacts/${appId}/users/${userId}/vocabCards`;

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const subTextClass = theme === THEMES.LIGHT ? 'text-gray-600' : theme === THEMES.MINIMALIST ? 'text-gray-700' : 'text-slate-300';
    const inputBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300 text-gray-800' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400 text-black' : 'bg-slate-700 border-slate-600 text-slate-100';
    const selectBgClass = theme === THEMES.LIGHT ? 'bg-gray-100 border-gray-300 text-gray-800' : theme === THEMES.MINIMALIST ? 'bg-white border-gray-400 text-black' : 'bg-slate-700 border-slate-600 text-slate-100';
    const buttonPrimaryClass = theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white';


    useEffect(() => {
        setCurrentSelectedDeckId(selectedDeckId); 
    }, [selectedDeckId]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentSelectedDeckId) {
            setMessage({ type: 'error', text: 'Please select a deck.'});
            return;
        }
        if (!front.trim() || !back.trim()) {
            setMessage({ type: 'error', text: 'Both front and back fields are required.' });
            return;
        }
        setIsLoading(true);
        setMessage('');

        try {
            const newCardData = {
                front: front.trim(),
                back: back.trim(),
                deckId: currentSelectedDeckId, 
                status: CardStatus.NEW,
                due: Timestamp.now(),
                intervalDays: 0,
                easeFactor: DEFAULT_EASE_FACTOR,
                learningStep: 0,
                lapses: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                userId: userId,
            };
            await addDoc(collection(db, cardsCollectionPath), newCardData);
            setMessage({ type: 'success', text: 'Card added successfully!' });
            setFront('');
            setBack('');
            setTimeout(() => { 
                setMessage('');
            }, 3000);
        } catch (error) {
            console.error("Error adding card:", error);
            setMessage({ type: 'error', text: 'Failed to add card. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };
        
    if (decks.length === 0 && !isLoadingDecks) { 
        return (
            <div className={`text-center p-8 ${cardBgClass} rounded-lg shadow-xl`}>
                <p className={`text-xl ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'}`}>You need to create a deck first.</p>
                <button onClick={() => {setSelectedDeckId(null); setActiveTab('decks')}} className={`mt-4 px-4 py-2 ${buttonPrimaryClass} rounded-lg`}>Go to Decks</button>
            </div>
        );
    }


    return (
        <div className={`${cardBgClass} p-6 sm:p-8 rounded-xl shadow-2xl`}>
            <h2 className={`text-2xl font-semibold mb-6 ${headerTextClass} flex items-center`}>
                <PlusCircle className={`mr-3 ${headerTextClass}`} size={28} /> Add Card to Deck: <em className={`ml-2 ${theme === THEMES.MINIMALIST ? 'text-sky-700' : 'text-sky-300'}`}>{decks.find(d => d.id === currentSelectedDeckId)?.name || "Select Deck"}</em>
            </h2>
             <div className="mb-4">
                <label htmlFor="deck-select" className={`block text-sm font-medium ${subTextClass} mb-1`}>Deck</label>
                <select
                    id="deck-select"
                    value={currentSelectedDeckId || ''}
                    onChange={(e) => { 
                        const newDeckId = e.target.value;
                        setCurrentSelectedDeckId(newDeckId); 
                        if (setSelectedDeckId && typeof setSelectedDeckId === 'function') {
                            setSelectedDeckId(newDeckId); 
                        }
                    }}
                    className={`w-full p-3 ${selectBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`}
                    disabled={decks.length === 0 || isLoading || isLoadingDecks}
                >
                    <option value="" disabled={!!currentSelectedDeckId}>-- Select a Deck --</option>
                    {decks.map(deck => (
                        <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                </select>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="front" className={`block text-sm font-medium ${subTextClass} mb-1`}>Front (Word/Phrase)</label>
                    <input type="text" id="front" value={front} onChange={(e) => setFront(e.target.value)} placeholder="e.g., Serendipity" className={`w-full p-3 ${inputBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`} disabled={isLoading || !currentSelectedDeckId} />
                </div>
                <div>
                    <label htmlFor="back" className={`block text-sm font-medium ${subTextClass} mb-1`}>Back (Definition/Translation)</label>
                    <textarea id="back" value={back} onChange={(e) => setBack(e.target.value)} placeholder="e.g., The occurrence and development of events by chance in a happy or beneficial way." rows="4" className={`w-full p-3 ${inputBgClass} rounded-lg focus:ring-2 focus:ring-sky-500`} disabled={isLoading || !currentSelectedDeckId}></textarea>
                </div>
                <button type="submit" disabled={isLoading || !currentSelectedDeckId} className={`w-full flex items-center justify-center p-3 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md disabled:opacity-50`}>
                    {isLoading ? 'Adding...' : <><PlusCircle size={20} className="mr-2" /> Add Card</>}
                </button>
            </form>
            {message.text && (
                <div className={`mt-4 p-3 rounded-md text-sm ${message.type === 'success' ? (theme === THEMES.MINIMALIST ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-green-700 text-green-100') : (theme === THEMES.MINIMALIST ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-red-700 text-red-100')}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
}

// --- Learner Component (SRS) ---
function Learner({ userId, selectedDeckId }) {
    const { theme } = useTheme();
    const [currentCard, setCurrentCard] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const cardsCollectionPath = `artifacts/${appId}/users/${userId}/vocabCards`;

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const cardContentBgClass = theme === THEMES.LIGHT ? 'bg-gray-100' : theme === THEMES.MINIMALIST ? 'bg-white border border-gray-200' : 'bg-slate-700';
    const cardFrontTextClass = theme === THEMES.LIGHT ? 'text-sky-700' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-300';
    const cardBackTextClass = theme === THEMES.LIGHT ? 'text-gray-700' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-200';
    const buttonBase = `p-3 rounded-lg shadow-md font-medium transition-colors`;
    const buttonAgain = theme === THEMES.MINIMALIST ? `bg-red-200 hover:bg-red-300 text-black` : `bg-red-600 hover:bg-red-500 text-white`;
    const buttonHard = theme === THEMES.MINIMALIST ? `bg-orange-200 hover:bg-orange-300 text-black` : `bg-orange-500 hover:bg-orange-400 text-white`;
    const buttonGood = theme === THEMES.MINIMALIST ? `bg-green-200 hover:bg-green-300 text-black` : `bg-green-600 hover:bg-green-500 text-white`;
    const buttonEasy = theme === THEMES.MINIMALIST ? `bg-sky-200 hover:bg-sky-300 text-black` : `bg-sky-500 hover:bg-sky-400 text-white`;
    const showAnswerButton = theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white';


    const fetchNextCard = useCallback(async () => {
        if (!selectedDeckId) {
            setMessage('Please select a deck to start learning.'); 
            setIsLoading(false);
            setCurrentCard(null);
            return;
        }
        setIsLoading(true);
        setMessage('');
        setCurrentCard(null);
        setShowAnswer(false);

        const now = Timestamp.now();
        let cardToReview = null; 

        try {
            const allCardsQuery = query(
                collection(db, cardsCollectionPath),
                where('userId', '==', userId),
                where('deckId', '==', selectedDeckId) 
            );
            const querySnapshot = await getDocs(allCardsQuery);
            const allCardsInDeck = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const dueLearningLapsedCards = allCardsInDeck
                .filter(card => (card.status === CardStatus.LEARNING || card.status === CardStatus.LAPSED) && card.due && card.due.toMillis() <= now.toMillis())
                .sort((a, b) => (a.due.toMillis() - b.due.toMillis()));
            
            const dueReviewCards = allCardsInDeck 
                .filter(card => card.status === CardStatus.REVIEW && card.due && card.due.toMillis() <= now.toMillis())
                .sort((a, b) => (a.due.toMillis() - b.due.toMillis()));

            const newCards = allCardsInDeck
                .filter(card => card.status === CardStatus.NEW)
                .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

            if (dueLearningLapsedCards.length > 0) cardToReview = dueLearningLapsedCards[0];
            else if (dueReviewCards.length > 0) cardToReview = dueReviewCards[0];
            else if (newCards.length > 0) cardToReview = newCards[0];

            if (cardToReview) setCurrentCard(cardToReview);
            else setMessage('No cards to learn in this deck right now. Add more or check back later!'); 
            
        } catch (error) {
            console.error("Error fetching next card for learning:", error); 
            setMessage('Error fetching card. Please try refreshing.');
        } finally {
            setIsLoading(false);
        }
    }, [userId, selectedDeckId, cardsCollectionPath]);

    useEffect(() => {
        fetchNextCard();
    }, [fetchNextCard]);

    const handleReviewAction = async (action) => { 
        if (!currentCard) return;

        setIsLoading(true);
        let updatedCard = { ...currentCard };
        const nowJSDate = new Date(); 

        if (updatedCard.due && updatedCard.due.toDate) updatedCard.due = updatedCard.due.toDate();
        if (updatedCard.createdAt && updatedCard.createdAt.toDate) updatedCard.createdAt = updatedCard.createdAt.toDate();
        
        let newEaseFactor = updatedCard.easeFactor;
        let newIntervalDays = updatedCard.intervalDays;

        switch (action) {
            case 'again':
                if (updatedCard.status === CardStatus.REVIEW) {
                    updatedCard.lapses = (updatedCard.lapses || 0) + 1;
                    newEaseFactor = Math.max(1.3, updatedCard.easeFactor - 0.20);
                }
                updatedCard.status = updatedCard.lapses > 0 ? CardStatus.LAPSED : CardStatus.LEARNING;
                updatedCard.learningStep = 0;
                const steps = updatedCard.status === CardStatus.LAPSED ? RELEARNING_STEPS_MINUTES : LEARNING_STEPS_MINUTES;
                updatedCard.due = addMinutesToDate(nowJSDate, steps[0]);
                newIntervalDays = 0;
                break;
            case 'hard':
                if (updatedCard.status === CardStatus.NEW || updatedCard.status === CardStatus.LEARNING || updatedCard.status === CardStatus.LAPSED) {
                    updatedCard.due = addMinutesToDate(nowJSDate, (updatedCard.status === CardStatus.LAPSED ? RELEARNING_STEPS_MINUTES : LEARNING_STEPS_MINUTES)[updatedCard.learningStep || 0]);
                } else if (updatedCard.status === CardStatus.REVIEW) {
                    newIntervalDays = Math.max(1, updatedCard.intervalDays * HARD_FACTOR_MULTIPLIER);
                    updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                    newEaseFactor = Math.max(1.3, updatedCard.easeFactor - 0.15);
                }
                break;
            case 'good':
                if (updatedCard.status === CardStatus.NEW || updatedCard.status === CardStatus.LEARNING) {
                    updatedCard.learningStep = (updatedCard.learningStep || 0) + 1;
                    if (updatedCard.learningStep < LEARNING_STEPS_MINUTES.length) {
                        updatedCard.status = CardStatus.LEARNING;
                        updatedCard.due = addMinutesToDate(nowJSDate, LEARNING_STEPS_MINUTES[updatedCard.learningStep]);
                    } else { 
                        updatedCard.status = CardStatus.REVIEW;
                        newIntervalDays = GRADUATING_INTERVAL_DAYS;
                        updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                        updatedCard.learningStep = 0; 
                    }
                } else if (updatedCard.status === CardStatus.LAPSED) {
                    updatedCard.learningStep = (updatedCard.learningStep || 0) + 1;
                    if (updatedCard.learningStep < RELEARNING_STEPS_MINUTES.length) {
                        updatedCard.due = addMinutesToDate(nowJSDate, RELEARNING_STEPS_MINUTES[updatedCard.learningStep]);
                    } else { 
                        updatedCard.status = CardStatus.REVIEW;
                        newIntervalDays = MIN_INTERVAL_DAYS_AFTER_LAPSE;
                        updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                        updatedCard.learningStep = 0;
                    }
                } else if (updatedCard.status === CardStatus.REVIEW) {
                    newIntervalDays = Math.max(1, updatedCard.intervalDays * updatedCard.easeFactor);
                    updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                }
                break;
            case 'easy':
                if (updatedCard.status === CardStatus.NEW || updatedCard.status === CardStatus.LEARNING || updatedCard.status === CardStatus.LAPSED) {
                    updatedCard.status = CardStatus.REVIEW;
                    newIntervalDays = EASY_INTERVAL_DAYS;
                    updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                    updatedCard.learningStep = 0;
                } else if (updatedCard.status === CardStatus.REVIEW) {
                    newIntervalDays = Math.max(1, updatedCard.intervalDays * updatedCard.easeFactor * EASY_BONUS_MULTIPLIER);
                    updatedCard.due = addDaysToDate(nowJSDate, newIntervalDays);
                    newEaseFactor = updatedCard.easeFactor + 0.15;
                }
                break;
            default: break;
        }

        updatedCard.easeFactor = parseFloat(newEaseFactor.toFixed(2));
        updatedCard.intervalDays = parseFloat(newIntervalDays.toFixed(2));
        updatedCard.updatedAt = serverTimestamp();
        updatedCard.due = Timestamp.fromDate(updatedCard.due);

        try {
            const cardRef = doc(db, cardsCollectionPath, currentCard.id);
            const { id, createdAt, ...dataToUpdate } = updatedCard; 
            await updateDoc(cardRef, dataToUpdate);
            fetchNextCard(); 
        } catch (error) {
            console.error("Error updating card during learning:", error); 
            setMessage('Error updating card. Please try again.');
            setIsLoading(false);
        }
    };

    if (isLoading && !currentCard) {
        return <div className={`flex flex-col items-center justify-center p-10 ${cardBgClass} rounded-xl shadow-2xl min-h-[300px]`}><Brain className={`animate-pulse w-12 h-12 ${headerTextClass} mb-4`} /><p className={`${textClass} text-lg`}>Loading cards for learning...</p></div>; 
    }
    if (!currentCard && !isLoading) {
        return <div className={`text-center p-10 ${cardBgClass} rounded-xl shadow-2xl min-h-[300px] flex flex-col justify-center items-center`}><BookOpen size={48} className={`${headerTextClass} mb-4`} /><p className={`text-xl ${textClass}`}>{message || 'All caught up with learning!'}</p></div>; 
    }
    if (!currentCard) return null;

    return (
        <div className={`${cardBgClass} p-6 sm:p-8 rounded-xl shadow-2xl w-full`}>
            <div className={`min-h-[200px] sm:min-h-[250px] flex flex-col justify-center items-center ${cardContentBgClass} p-6 rounded-lg mb-6 shadow-inner`}>
                <p className={`text-2xl sm:text-3xl font-bold text-center ${cardFrontTextClass} break-all`}>{currentCard.front}</p>
                {showAnswer && <p className={`mt-4 text-lg sm:text-xl text-center ${cardBackTextClass} break-all`}>{currentCard.back}</p>}
            </div>
            {isLoading && currentCard && <div className="flex items-center justify-center my-4"><svg className={`animate-spin h-6 w-6 ${headerTextClass}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className={`ml-2 ${textClass}`}>Processing...</span></div>}
            {!showAnswer && !isLoading && <button onClick={() => setShowAnswer(true)} className={`w-full p-3 ${showAnswerButton} font-semibold rounded-lg shadow-md`}>Show Answer</button>}
            {showAnswer && !isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <button onClick={() => handleReviewAction('again')} className={`${buttonBase} ${buttonAgain}`}>Again</button>
                    <button onClick={() => handleReviewAction('hard')} className={`${buttonBase} ${buttonHard}`}>Hard</button>
                    <button onClick={() => handleReviewAction('good')} className={`${buttonBase} ${buttonGood}`}>Good</button>
                    <button onClick={() => handleReviewAction('easy')} className={`${buttonBase} ${buttonEasy}`}>Easy</button>
                </div>
            )}
        </div>
    );
}

// --- PracticeReviewer Component (Non-SRS) ---
function PracticeReviewer({ userId, selectedDeckId, deckName, exitPracticeMode }) {
    const { theme } = useTheme();
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const cardsCollectionPath = `artifacts/${appId}/users/${userId}/vocabCards`;

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-amber-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-amber-400';
    const cardContentBgClass = theme === THEMES.LIGHT ? 'bg-gray-100' : theme === THEMES.MINIMALIST ? 'bg-white border border-gray-200' : 'bg-slate-700';
    const cardFrontTextClass = theme === THEMES.LIGHT ? 'text-sky-700' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-300';
    const cardBackTextClass = theme === THEMES.LIGHT ? 'text-gray-700' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-200';
    const buttonPrimaryClass = theme === THEMES.MINIMALIST ? 'bg-sky-200 hover:bg-sky-300 text-black' : 'bg-sky-600 hover:bg-sky-500 text-white';
    const buttonSuccessClass = theme === THEMES.MINIMALIST ? 'bg-green-200 hover:bg-green-300 text-black' : 'bg-green-600 hover:bg-green-500 text-white';
    const buttonSecondaryClass = theme === THEMES.MINIMALIST ? 'bg-gray-200 hover:bg-gray-300 text-black' : 'bg-slate-600 hover:bg-slate-500 text-white';


    useEffect(() => {
        if (!selectedDeckId) {
            setMessage('No deck selected for practice.');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const fetchCardsForPractice = async () => {
            try {
                const q = query(
                    collection(db, cardsCollectionPath),
                    where('userId', '==', userId),
                    where('deckId', '==', selectedDeckId)
                );
                const querySnapshot = await getDocs(q);
                let fetchedCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                for (let i = fetchedCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [fetchedCards[i], fetchedCards[j]] = [fetchedCards[j], fetchedCards[i]];
                }
                setCards(fetchedCards);
                setCurrentIndex(0);
                setShowAnswer(false); 
                if (fetchedCards.length === 0) {
                    setMessage(`No cards in "${deckName}" to practice.`);
                } else {
                    setMessage(''); 
                }
            } catch (error) {
                console.error("Error fetching cards for practice:", error);
                setMessage("Error loading cards for practice.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchCardsForPractice();
    }, [userId, selectedDeckId, cardsCollectionPath, deckName]);

    const handleNextCard = () => {
        setShowAnswer(false);
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(prevIndex => prevIndex + 1);
        } else {
            setMessage("You've practiced all cards in this deck!");
        }
    };
    
    const currentCard = cards.length > 0 ? cards[currentIndex] : null;

    if (isLoading) {
        return <div className={`flex flex-col items-center justify-center p-10 ${cardBgClass} rounded-xl shadow-2xl min-h-[300px]`}><Shuffle className={`animate-ping w-12 h-12 ${headerTextClass} mb-4`} /><p className={`${textClass} text-lg`}>Preparing Practice Session...</p></div>;
    }
    if (!currentCard && !isLoading) { 
        return (
            <div className={`text-center p-10 ${cardBgClass} rounded-xl shadow-2xl min-h-[300px] flex flex-col justify-center items-center`}>
                <BookOpen size={48} className={`${headerTextClass} mb-4`} /> 
                <p className={`text-xl ${textClass}`}>{message || `No cards to practice in "${deckName}".`}</p>
                <button onClick={exitPracticeMode} className={`mt-4 px-4 py-2 ${buttonPrimaryClass} rounded-lg`}>Back to Decks</button>
            </div>
        );
    }
    if (!currentCard) return null;


    return (
        <div className={`${cardBgClass} p-6 sm:p-8 rounded-xl shadow-2xl w-full`}>
             <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-semibold ${headerTextClass}`}>Practice: {deckName}</h3>
                <span className={`text-sm ${theme === THEMES.MINIMALIST ? 'text-gray-600' : 'text-slate-400'}`}>Card {currentIndex + 1} of {cards.length}</span>
            </div>
            <div className={`min-h-[200px] sm:min-h-[250px] flex flex-col justify-center items-center ${cardContentBgClass} p-6 rounded-lg mb-6 shadow-inner`}>
                <p className={`text-2xl sm:text-3xl font-bold text-center ${cardFrontTextClass} break-all`}>{currentCard.front}</p>
                {showAnswer && <p className={`mt-4 text-lg sm:text-xl text-center ${cardBackTextClass} break-all`}>{currentCard.back}</p>}
            </div>
            
            {!showAnswer && (
                <button onClick={() => setShowAnswer(true)} className={`w-full p-3 ${buttonPrimaryClass} font-semibold rounded-lg shadow-md`}>Show Answer</button>
            )}
            {showAnswer && (
                 <button 
                    onClick={handleNextCard} 
                    className={`w-full p-3 ${buttonSuccessClass} font-semibold rounded-lg shadow-md`}
                    disabled={currentIndex >= cards.length -1 && message === "You've practiced all cards in this deck!"} 
                 >
                    {currentIndex < cards.length - 1 ? "Next Card" : "Finish Practice"}
                </button>
            )}
            <button onClick={exitPracticeMode} className={`mt-4 w-full p-2 ${buttonSecondaryClass} rounded-lg text-sm`}>Exit Practice</button>
        </div>
    );
}


// --- Stats Component ---
function Stats({ userId, selectedDeckId }) {
    const { theme } = useTheme();
    const [stats, setStats] = useState({ total: 0, new: 0, learning: 0, review: 0, lapsed: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const cardsCollectionPath = `artifacts/${appId}/users/${userId}/vocabCards`;

    const cardBgClass = theme === THEMES.LIGHT ? 'bg-white' : theme === THEMES.MINIMALIST ? 'bg-gray-50 border border-gray-300' : 'bg-slate-800';
    const itemBgClass = theme === THEMES.LIGHT ? 'bg-gray-100' : theme === THEMES.MINIMALIST ? 'bg-white border border-gray-200' : 'bg-slate-700';
    const textClass = theme === THEMES.LIGHT ? 'text-gray-800' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-slate-100';
    const headerTextClass = theme === THEMES.LIGHT ? 'text-sky-600' : theme === THEMES.MINIMALIST ? 'text-black' : 'text-sky-400';
    const subTextClass = theme === THEMES.LIGHT ? 'text-gray-600' : theme === THEMES.MINIMALIST ? 'text-gray-700' : 'text-slate-300';
    const statValueClasses = {
        total: theme === THEMES.MINIMALIST ? 'text-sky-700' : 'text-sky-400',
        new: theme === THEMES.MINIMALIST ? 'text-green-700' : 'text-green-400',
        learning: theme === THEMES.MINIMALIST ? 'text-yellow-600' : 'text-yellow-400',
        review: theme === THEMES.MINIMALIST ? 'text-blue-700' : 'text-blue-400',
        lapsed: theme === THEMES.MINIMALIST ? 'text-red-700' : 'text-red-400',
    };


    useEffect(() => {
        if (!userId || !selectedDeckId) {
             setStats({ total: 0, new: 0, learning: 0, review: 0, lapsed: 0 });
             setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const fetchStats = async () => {
            try {
                const q = query(
                    collection(db, cardsCollectionPath), 
                    where('userId', '==', userId),
                    where('deckId', '==', selectedDeckId) 
                );
                const querySnapshot = await getDocs(q);
                let newCount = 0, learningCount = 0, reviewCount = 0, lapsedCount = 0;
                querySnapshot.forEach(doc => {
                    const card = doc.data();
                    switch (card.status) {
                        case CardStatus.NEW: newCount++; break;
                        case CardStatus.LEARNING: learningCount++; break;
                        case CardStatus.REVIEW: reviewCount++; break; 
                        case CardStatus.LAPSED: lapsedCount++; break;
                        default: break;
                    }
                });
                setStats({ total: querySnapshot.size, new: newCount, learning: learningCount, review: reviewCount, lapsed: lapsedCount });
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [userId, selectedDeckId, cardsCollectionPath]);

    if (isLoading) {
        return <div className={`flex flex-col items-center justify-center p-10 ${cardBgClass} rounded-xl shadow-2xl min-h-[200px]`}><BarChart3 className={`animate-pulse w-12 h-12 ${headerTextClass} mb-4`} /><p className={`${textClass} text-lg`}>Loading stats...</p></div>;
    }
     if (!selectedDeckId && !isLoading) { 
        return <div className={`text-center p-8 ${cardBgClass} rounded-lg shadow-xl`}><p className={`text-xl ${theme === THEMES.MINIMALIST ? 'text-amber-700' : 'text-amber-400'}`}>Please select a deck from the 'Decks' tab to view stats.</p></div>;
    }

    return (
        <div className={`${cardBgClass} p-6 sm:p-8 rounded-xl shadow-2xl`}>
            <h2 className={`text-2xl font-semibold mb-6 ${headerTextClass} flex items-center`}>
                <BarChart3 className={`mr-3 ${headerTextClass}`} size={28} /> Deck Statistics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`${itemBgClass} p-4 rounded-lg shadow`}><p className={`text-3xl font-bold ${statValueClasses.total}`}>{stats.total}</p><p className={`text-sm ${subTextClass}`}>Total Cards</p></div>
                <div className={`${itemBgClass} p-4 rounded-lg shadow`}><p className={`text-3xl font-bold ${statValueClasses.new}`}>{stats.new}</p><p className={`text-sm ${subTextClass}`}>New</p></div>
                <div className={`${itemBgClass} p-4 rounded-lg shadow`}><p className={`text-3xl font-bold ${statValueClasses.learning}`}>{stats.learning}</p><p className={`text-sm ${subTextClass}`}>Learning</p></div>
                <div className={`${itemBgClass} p-4 rounded-lg shadow`}><p className={`text-3xl font-bold ${statValueClasses.review}`}>{stats.review}</p><p className={`text-sm ${subTextClass}`}>Scheduled (Review)</p></div> 
                <div className={`${itemBgClass} p-4 rounded-lg shadow col-span-1 sm:col-span-2`}><p className={`text-3xl font-bold ${statValueClasses.lapsed}`}>{stats.lapsed}</p><p className={`text-sm ${subTextClass}`}>Lapsed</p></div>
            </div>
        </div>
    );
}

export default AppWrapper;
