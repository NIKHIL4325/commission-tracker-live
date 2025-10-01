import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';

// --- 1. FIREBASE CONFIGURATION FOR NETLIFY/GITHUB ---
// IMPORTANT: We read standard React environment variables (REACT_APP_...).
// These MUST be set in Netlify's build settings using your keys.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

let app, db, auth;
let isConfigValid = true;

if (!firebaseConfig.apiKey) {
    console.error("Firebase config is missing Environment Variables. Check Netlify settings.");
    isConfigValid = false;
}

if (isConfigValid) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
}


// === UTILITY COMPONENTS ===

const StatusBadge = ({ status }) => {
    const baseStyle = "px-3 py-1 text-xs font-semibold rounded-full";
    let colorStyle;
    switch (status) {
        case 'Open':
            colorStyle = 'bg-yellow-100 text-yellow-800';
            break;
        case 'In Progress':
            colorStyle = 'bg-blue-100 text-blue-800';
            break;
        case 'Resolved':
            colorStyle = 'bg-green-100 text-green-800';
            break;
        default:
            colorStyle = 'bg-gray-100 text-gray-800';
    }
    return <span className={`${baseStyle} ${colorStyle}`}>{status}</span>;
};

const TicketCard = React.memo(({ ticket, user, onUpdate, onDelete }) => {
    const isOwner = user?.uid === ticket.userId;

    const formatTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        return timestamp.toDate().toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const handleStatusChange = (newStatus) => {
        onUpdate(ticket.id, { status: newStatus });
    };

    const StatusDropdown = useMemo(() => (
        <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="p-2 rounded-lg border focus:ring-2 cursor-pointer bg-white hover:bg-gray-50"
        >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
        </select>
    ), [ticket.status, handleStatusChange]);


    return (
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition duration-300 border-t-4 border-indigo-500 flex flex-col space-y-4">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-gray-800 truncate pr-4">{ticket.title}</h3>
                <StatusBadge status={ticket.status} />
            </div>

            <p className="text-sm text-gray-600 flex-grow leading-relaxed line-clamp-3">{ticket.description}</p>

            <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 text-indigo-500 text-lg">👤</span>
                    <span className="font-medium text-gray-700">Owner ID:</span>
                    <code className="bg-gray-100 px-1 rounded truncate flex-1">{ticket.userId}</code>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 text-indigo-500 text-lg">📅</span>
                    <span className="font-medium text-gray-700">Created:</span>
                    <span>{formatTimestamp(ticket.createdAt)}</span>
                </div>
            </div>
            
            <div className="flex justify-between items-center pt-3">
                {StatusDropdown}
                
                {isOwner && (
                    <button
                        onClick={() => onDelete(ticket.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition duration-150"
                        title="Delete Ticket"
                    >
                        {/* SVG Trash Can Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 0 0 1 2 2v2"></path></svg>
                    </button>
                )}
            </div>
        </div>
    );
});

// === MAIN APPLICATION COMPONENT ===

function App() {
    if (!isConfigValid || !auth) {
        return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 text-red-600">Firebase keys are missing. Please check your Netlify Environment Variables.</div>;
    }
    
    const [tickets, setTickets] = useState([]);
    const [user, setUser] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('My Tickets'); 
    
    // Hardcoded path used in security rules
    const BASE_COLLECTION_PATH = 'artifacts/default-app-id/public/data/tickets';


    // 1. AUTHENTICATION (Sign in anonymously)
    useEffect(() => {
        const authenticateUser = async () => {
            try {
                await signInAnonymously(auth); 
            } catch (error) {
                console.error("Authentication failed:", error);
            }
        };

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                authenticateUser();
            }
            setLoading(false);
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. DATA LISTENER (Real-time updates)
    useEffect(() => {
        if (!user || !db) return;
        
        let ticketsQuery;
        
        if (view === 'My Tickets') {
            ticketsQuery = query(
                collection(db, BASE_COLLECTION_PATH),
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );
        } else {
            ticketsQuery = query(collection(db, BASE_COLLECTION_PATH), orderBy('createdAt', 'desc'));
        }

        const unsubscribeFirestore = onSnapshot(ticketsQuery, (snapshot) => {
            const fetchedTickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTickets(fetchedTickets);
        }, (error) => {
            console.error("Error listening to tickets: ", error);
        });

        return () => unsubscribeFirestore();
    }, [user, view]); 

    // === CRUD OPERATIONS ===

    const createTicket = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim() || !user) return;
        
        try {
            await addDoc(collection(db, BASE_COLLECTION_PATH), {
                title: title.trim(),
                description: description.trim(),
                status: 'Open',
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
            setTitle('');
            setDescription('');
        } catch (error) {
            console.error("Error creating document: ", error);
        }
    };

    const updateTicketStatus = useCallback(async (id, data) => {
        const docPath = `${BASE_COLLECTION_PATH}/${id}`;
        
        try {
            const ticketRef = doc(db, docPath);
            await updateDoc(ticketRef, data);
        } catch (error) {
            console.error("Error updating document: ", error);
        }
    }, []);

    const deleteTicket = useCallback(async (id) => {
        // NOTE: Using a custom modal/dialog is preferred over window.confirm in production
        // For mobile simplicity, we use a built-in confirm here
        if (window.confirm("Are you sure you want to delete this ticket?")) {
            const docPath = `${BASE_COLLECTION_PATH}/${id}`;
            try {
                await deleteDoc(doc(db, docPath));
            } catch (error) {
                console.error("Error deleting document: ", error);
            }
        }
    }, []);

    // === STATS VIEW DATA ===
    const stats = useMemo(() => {
        const total = tickets.length;
        const open = tickets.filter(t => t.status === 'Open').length;
        const inProgress = tickets.filter(t => t.status === 'In Progress').length;
        const resolved = tickets.filter(t => t.status === 'Resolved').length;

        return {
            total,
            open,
            inProgress,
            resolved,
            openPercent: total > 0 ? ((open / total) * 100).toFixed(1) : 0,
            inProgressPercent: total > 0 ? ((inProgress / total) * 100).toFixed(1) : 0,
            resolvedPercent: total > 0 ? ((resolved / total) * 100).toFixed(1) : 0,
        };
    }, [tickets]);

    // === SUB-VIEW RENDERING ===
    
    const renderTicketView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.length > 0 ? (
                tickets.map(ticket => (
                    <TicketCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        user={user} 
                        onUpdate={updateTicketStatus} 
                        onDelete={deleteTicket} 
                    />
                ))
            ) : (
                <div className="lg:col-span-3 bg-gray-100 p-6 rounded-xl text-center text-gray-500 shadow-inner">
                    No {view === 'My Tickets' ? 'personal' : 'active'} tickets found.
                </div>
            )}
        </div>
    );

    const renderStatsView = () => (
        <div className="space-y-8">
            <h2 className="text-3xl font-extrabold text-gray-900">Ticket Metrics Overview</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[{ label: 'Total Tickets', value: stats.total, color: 'text-indigo-600', icon: '📊' }, 
                   { label: 'Open', value: stats.open, color: 'text-yellow-600', icon: '⏳' }, 
                   { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600', icon: '💬' }, 
                   { label: 'Resolved', value: stats.resolved, color: 'text-green-600', icon: '✅' }, 
                 ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="bg-white p-6 rounded-xl shadow-md border-b-4 border-gray-100 hover:border-indigo-500 transition duration-300">
                        <div className="flex items-center space-x-3">
                            <span className={`w-6 h-6 text-xl ${color}`}>{Icon}</span> 
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                        </div>
                        <p className="mt-2 text-4xl font-extrabold text-gray-900">{value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Status Distribution ({stats.total} Total)</h3>
                <div className="space-y-4">
                    {/* Progress Bar for Open */}
                    <div className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium text-yellow-800">Open ({stats.openPercent}%)</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-yellow-500 h-3 rounded-full" style={{ width: `${stats.openPercent}%` }}></div>
                        </div>
                    </div>
                    {/* Progress Bar for In Progress */}
                    <div className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium text-blue-800">In Progress ({stats.inProgressPercent}%)</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${stats.inProgressPercent}%` }}></div>
                        </div>
                    </div>
                    {/* Progress Bar for Resolved */}
                    <div className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium text-green-800">Resolved ({stats.resolvedPercent}%)</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-green-500 h-3 rounded-full" style={{ width: `${stats.resolvedPercent}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    
    // === MAIN RENDER ===

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 text-xl font-semibold">
                Connecting to Secure Service...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>

            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-extrabold text-indigo-600">
                        CommissionGuard <span className="text-gray-900">Platform</span>
                    </h1>
                    <div className="text-sm text-gray-500 p-2 bg-indigo-50 rounded-lg hidden sm:block">
                        Your User ID: <code className="font-mono text-indigo-800">{user?.uid || 'N/A'}</code>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Navigation and Actions */}
                <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    {/* View Switcher */}
                    <div className="flex space-x-3 bg-white p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => setView('My Tickets')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${view === 'My Tickets' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            My Tickets
                        </button>
                        <button
                            onClick={() => setView('All Tickets')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${view === 'All Tickets' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            All Tickets
                        </button>
                        <button
                            onClick={() => setView('Stats')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${view === 'Stats' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Stats
                        </button>
                    </div>

                    {/* New Ticket Button (only show in list views) */}
                    {(view === 'My Tickets' || view === 'All Tickets') && (
                         <a href="#new-ticket-form" className="flex items-center space-x-2 px-5 py-2 bg-green-500 text-white font-semibold rounded-xl shadow-lg hover:bg-green-600 transition duration-150 transform hover:scale-105">
                            <span className="text-xl">➕</span>
                            <span>Create New Ticket</span>
                        </a>
                    )}
                </div>

                {/* Content Area */}
                {view === 'Stats' ? renderStatsView() : renderTicketView()}

                {/* New Ticket Form (Always visible below the main content) */}
                <div id="new-ticket-form" className="mt-12 p-8 bg-white rounded-xl shadow-2xl border-t-4 border-green-500">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
                        <span className="w-6 h-6 text-2xl text-green-500">➕</span>
                        <span>Submit a New Commission Ticket</span>
                    </h2>
                    <form onSubmit={createTicket} className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                                Title (Concise Summary)
                            </label>
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Refund for double-charged order #457"
                                required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                Full Description (Include details, dates, and order IDs)
                            </label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Provide all necessary information for resolution..."
                                rows="4"
                                required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            ></textarea>
                        </div>
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 transform hover:scale-105"
                            disabled={!user}
                        >
                            Submit Ticket
                        </button>
                        {!user && <p className="text-sm text-red-500 mt-2">Authenticating user...</p>}
                    </form>
                </div>

                <div className="mt-8 text-center text-sm text-gray-400 p-4">
                    <p>© 2025 CommissionGuard. Powered by Firebase & Netlify.</p>
                </div>
            </main>
        </div>
    );
}

export default App;
