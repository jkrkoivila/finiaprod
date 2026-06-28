/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import MobileTabs from "./components/MobileTabs";
import ChatAgent from "./components/ChatAgent";
import SignIn from "./components/SignIn";
import Onboarding from "./components/Onboarding";

// Firebase Services
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from "firebase/firestore";

// Views
import DashboardView from "./components/DashboardView";
import TasksView from "./components/TasksView";
import CalendarView from "./components/CalendarView";
import FinanceView from "./components/FinanceView";
import BillsView from "./components/BillsView";
import TaxView from "./components/TaxView";
import DocumentsView from "./components/DocumentsView";
import AnalyticsView from "./components/AnalyticsView";
import CrisisModeView from "./components/CrisisModeView";

import { getDeletionSummary, deleteDocumentAndData, deleteDataOnly } from "./lib/documentService";

// Types
import { ActiveView, Task, FinanceEntry, Bill, Subscription, Receivable, Document } from "./types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeView, setView] = useState<ActiveView>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState<string | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("dark_mode") === "true";
  });

  // Firestore Collections Loading State
  const [loadedCollections, setLoadedCollections] = useState({
    tasks: false,
    transactions: false,
    bills: false,
    documents: false,
    taxProfile: false,
    subscriptions: false,
    receivables: false
  });

  // Apply Dark Mode Side-effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dark_mode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dark_mode", "false");
    }
  }, [isDarkMode]);

  // Auth State
  const [user, setUser] = useState<User | null>(() => {
    const isDemo = localStorage.getItem("finia_demo_mode") === "true";
    if (isDemo) {
      return { uid: "demo-user", email: "demo@finia.ai", displayName: "Demo User" } as User;
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem("onboarding_completed") === "true";
  });

  // Demo / Sandbox Mode State
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem("finia_demo_mode") === "true";
  });

  const [demoTasks, setDemoTasks] = useState<Task[]>([]);
  const [demoFinanceEntries, setDemoFinanceEntries] = useState<FinanceEntry[]>([]);
  const [demoBills, setDemoBills] = useState<Bill[]>([]);
  const [demoDocuments, setDemoDocuments] = useState<Document[]>([]);
  const [demoSubscriptions, setDemoSubscriptions] = useState<Subscription[]>([]);
  const [demoReceivables, setDemoReceivables] = useState<Receivable[]>([]);
  const [demoTaxProfile, setDemoTaxProfile] = useState({
    grossIncome: 1200000,
    deduction80C: 150000,
    deduction80D: 25000,
    hraReceived: 240000,
    homeLoanInterest: 0,
    deduction80CCD: 50000,
    deduction80E: 0,
    deduction80G: 0,
  });

  useEffect(() => {
    setDemoTasks([
      {
        id: "demo-t1",
        title: "file itr-1 for assessment year 2026-27",
        dueDate: "2026-07-31",
        category: "tax",
        completed: false,
        priority: "high",
      },
      {
        id: "demo-t2",
        title: "link pan card with aadhaar registration",
        dueDate: "2026-06-30",
        category: "tax",
        completed: false,
        priority: "high",
      },
      {
        id: "demo-t3",
        title: "review quarterly mutual fund sip portfolio",
        dueDate: "2026-06-28",
        category: "finance",
        completed: false,
        priority: "medium",
      },
      {
        id: "demo-t4",
        title: "settle pg room maintenance fees",
        dueDate: "2026-07-01",
        category: "personal",
        completed: true,
        priority: "low",
      },
    ]);

    setDemoFinanceEntries([
      {
        id: "demo-f1",
        description: "monthly salary credits",
        amount: 68000,
        type: "income",
        category: "salary",
        date: "2026-06-01",
      },
      {
        id: "demo-f2",
        description: "hdfc mutual fund SIP debit",
        amount: 5000,
        type: "expense",
        category: "investment",
        date: "2026-06-10",
      },
      {
        id: "demo-f3",
        description: "swiggy dinner order",
        amount: 480,
        type: "expense",
        category: "lifestyle",
        date: "2026-06-24",
      },
      {
        id: "demo-f4",
        description: "cutting chai and samosa",
        amount: 40,
        type: "expense",
        category: "lifestyle",
        date: "2026-06-25",
      },
    ]);

    setDemoBills([
      {
        id: "demo-b1",
        payee: "bescom electricity card",
        amount: 1240,
        dueDate: "2026-06-28",
        paid: false,
        category: "electricity",
      },
      {
        id: "demo-b2",
        payee: "jio fibre broadband",
        amount: 825,
        dueDate: "2026-06-30",
        paid: false,
        category: "internet",
      },
      {
        id: "demo-b3",
        payee: "icici credit card statement",
        amount: 12500,
        dueDate: "2026-06-18",
        paid: true,
        category: "credit-card",
      },
    ]);

    setDemoDocuments([
      {
        id: "demo-d1",
        userId: "demo-user",
        fileName: "form_16_assessment_year_2026.pdf",
        fileType: "Tax",
        storageUrl: "https://example.com/form_16_assessment_year_2026.pdf",
        uploadedAt: "2026-06-15T12:00:00Z",
        status: "imported",
        extractedData: {
          summary: "Official Form 16 salary deduction and taxable income summary for assessment year 2026."
        },
        confidenceFlags: {}
      },
      {
        id: "demo-d2",
        userId: "demo-user",
        fileName: "lic_premium_receipt_fy25_26.pdf",
        fileType: "Insurance",
        storageUrl: "https://example.com/lic_premium_receipt_fy25_26.pdf",
        uploadedAt: "2026-06-18T12:00:00Z",
        status: "imported",
        extractedData: {
          summary: "Tax saving premium certificate under Section 80C for life insurance policy."
        },
        confidenceFlags: {}
      },
    ]);
  }, []);

  useEffect(() => {
    localStorage.setItem("finia_demo_mode", isDemoMode ? "true" : "false");
    if (isDemoMode) {
      if (!user) {
        setUser({ uid: "demo-user", email: "demo@finia.ai", displayName: "Demo User" } as User);
      }
    } else {
      if (user?.uid === "demo-user") {
        setUser(null);
      }
    }
  }, [isDemoMode]);

  // Clear Firestore Database Data States
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearingInProgress, setClearingInProgress] = useState(false);

  // Firestore Synchronized State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [taxProfile, setTaxProfile] = useState({
    grossIncome: 1200000,
    deduction80C: 150000,
    deduction80D: 25000,
    hraReceived: 0,
    homeLoanInterest: 0,
    deduction80CCD: 0,
    deduction80E: 0,
    deduction80G: 0,
  });
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const derivedSubsRef = React.useRef<Set<string>>(new Set());

  const handleClearAllData = async () => {
    if (!user) return;
    const uid = user.uid;
    setClearingInProgress(true);
    try {
      // 1. Delete tasks
      const qTasks = query(collection(db, "tasks"), where("userId", "==", uid));
      const snapTasks = await getDocs(qTasks);
      for (const d of snapTasks.docs) {
        try {
          await deleteDoc(doc(db, "tasks", d.id));
        } catch (e) {
          console.error("Error deleting task:", d.id, e);
        }
      }

      // 2. Delete transactions
      const qTrans = query(collection(db, "transactions"), where("userId", "==", uid));
      const snapTrans = await getDocs(qTrans);
      for (const d of snapTrans.docs) {
        try {
          await deleteDoc(doc(db, "transactions", d.id));
        } catch (e) {
          console.error("Error deleting transaction:", d.id, e);
        }
      }

      // 3. Delete bills
      const qBills = query(collection(db, "bills"), where("userId", "==", uid));
      const snapBills = await getDocs(qBills);
      for (const d of snapBills.docs) {
        try {
          await deleteDoc(doc(db, "bills", d.id));
        } catch (e) {
          console.error("Error deleting bill:", d.id, e);
        }
      }

      // 4. Delete documents
      const qDocs = query(collection(db, "documents"), where("userId", "==", uid));
      const snapDocs = await getDocs(qDocs);
      for (const d of snapDocs.docs) {
        try {
          await deleteDoc(doc(db, "documents", d.id));
        } catch (e) {
          console.error("Error deleting document:", d.id, e);
        }
      }

      // 5. Reset taxProfile to zeroes
      try {
        await setDoc(doc(db, "taxProfile", uid), {
          userId: uid,
          grossIncome: 0,
          deduction80C: 0,
          deduction80D: 0,
          hraReceived: 0,
          homeLoanInterest: 0,
          deduction80CCD: 0,
          deduction80E: 0,
          deduction80G: 0,
        });
      } catch (e) {
        console.error("Error resetting taxProfile:", e);
      }

      // 6. Delete subscriptions
      const qSubs = query(collection(db, "subscriptions"), where("userId", "==", uid));
      const snapSubs = await getDocs(qSubs);
      for (const d of snapSubs.docs) {
        try {
          await deleteDoc(doc(db, "subscriptions", d.id));
        } catch (e) {
          console.error("Error deleting subscription:", d.id, e);
        }
      }

      // 7. Delete receivables
      const qRecs = query(collection(db, "receivables"), where("userId", "==", uid));
      const snapRecs = await getDocs(qRecs);
      for (const d of snapRecs.docs) {
        try {
          await deleteDoc(doc(db, "receivables", d.id));
        } catch (e) {
          console.error("Error deleting receivable:", d.id, e);
        }
      }

      derivedSubsRef.current.clear();
      setIsClearModalOpen(false);
    } catch (err) {
      console.error("Error in clearing operation:", err);
    } finally {
      setClearingInProgress(false);
    }
  };

  // Initialize empty database profile for a new user
  const seedDefaultUserData = async (uid: string, email: string | null, displayName: string | null) => {
    try {
      // 1. Create user document
      try {
        await setDoc(doc(db, "users", uid), {
          uid,
          email: email || "",
          displayName: displayName || "",
          photoURL: auth.currentUser?.photoURL || "",
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      }

      // 2. Initialize dynamic empty taxProfile
      try {
        await setDoc(doc(db, "taxProfile", uid), {
          userId: uid,
          grossIncome: 0,
          deduction80C: 0,
          deduction80D: 0,
          hraReceived: 0,
          homeLoanInterest: 0,
          deduction80CCD: 0,
          deduction80E: 0,
          deduction80G: 0,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `taxProfile/${uid}`);
      }

    } catch (error) {
      console.error("Error initializing user data: ", error);
    }
  };

  // Auth State Listener & Firestore Observers
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Check if user document exists in firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            // Seed defaults for new user
            await seedDefaultUserData(currentUser.uid, currentUser.email, currentUser.displayName);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        const isDemo = localStorage.getItem("finia_demo_mode") === "true";
        if (isDemo) {
          setUser({ uid: "demo-user", email: "demo@finia.ai", displayName: "Demo User" } as User);
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time Firestore synchronizers
  useEffect(() => {
    if (!user || isDemoMode) return;

    const uid = user.uid;

    // 1. Sync Tasks
    const qTasks = query(collection(db, "tasks"), where("userId", "==", uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          title: data.title,
          dueDate: data.dueDate,
          category: data.category,
          completed: data.completed,
          priority: data.priority,
          amount: data.amount,
        });
      });
      // Sort to show uncompleted/higher priority first or default ordering
      setTasks(list);
      setLoadedCollections(prev => ({ ...prev, tasks: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "tasks");
      setLoadedCollections(prev => ({ ...prev, tasks: true }));
    });

    // 2. Sync Finance Entries (Transactions)
    const qTrans = query(collection(db, "transactions"), where("userId", "==", uid));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const list: FinanceEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          description: data.description,
          amount: Number(data.amount),
          type: data.type,
          category: data.category,
          date: data.date,
        });
      });
      // Sort by date descending
      list.sort((a, b) => b.date.localeCompare(a.date));
      setFinanceEntries(list);
      setLoadedCollections(prev => ({ ...prev, transactions: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
      setLoadedCollections(prev => ({ ...prev, transactions: true }));
    });

    // 3. Sync Bills
    const qBills = query(collection(db, "bills"), where("userId", "==", uid));
    const unsubBills = onSnapshot(qBills, (snapshot) => {
      const list: Bill[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          payee: data.payee,
          amount: Number(data.amount),
          dueDate: data.dueDate,
          paid: data.paid,
          category: data.category,
        });
      });
      setBills(list);
      setLoadedCollections(prev => ({ ...prev, bills: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bills");
      setLoadedCollections(prev => ({ ...prev, bills: true }));
    });

    const qDocs = query(collection(db, "documents"), where("userId", "==", uid));
    const unsubDocs = onSnapshot(qDocs, (snapshot) => {
      const list: Document[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          userId: data.userId || uid,
          fileName: data.fileName || data.name || "",
          fileType: data.fileType || data.type || "uncategorized",
          storageUrl: data.storageUrl || "",
          uploadedAt: data.uploadedAt || data.uploadDate || new Date().toISOString(),
          status: data.status || "imported",
          extractedData: data.extractedData || {},
          confidenceFlags: data.confidenceFlags || {},
        });
      });
      setDocuments(list);
      setLoadedCollections(prev => ({ ...prev, documents: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "documents");
      setLoadedCollections(prev => ({ ...prev, documents: true }));
    });

    // 5. Sync Tax Profile
    const unsubTax = onSnapshot(doc(db, "taxProfile", uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTaxProfile({
          grossIncome: data.grossIncome ?? 1200000,
          deduction80C: data.deduction80C ?? 150000,
          deduction80D: data.deduction80D ?? 25000,
          hraReceived: data.hraReceived ?? 0,
          homeLoanInterest: data.homeLoanInterest ?? 0,
          deduction80CCD: data.deduction80CCD ?? 0,
          deduction80E: data.deduction80E ?? 0,
          deduction80G: data.deduction80G ?? 0,
        });
      }
      setLoadedCollections(prev => ({ ...prev, taxProfile: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `taxProfile/${uid}`);
      setLoadedCollections(prev => ({ ...prev, taxProfile: true }));
    });

    // 6. Sync Subscriptions
    const qSubs = query(collection(db, "subscriptions"), where("userId", "==", uid));
    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      const list: Subscription[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name,
          amount: Number(data.amount),
          frequency: data.frequency,
          category: data.category,
          lastUsedDays: Number(data.lastUsedDays || 1),
          active: data.active ?? true,
          isUnused: data.isUnused ?? false,
        });
      });
      setSubscriptions(list);
      setLoadedCollections(prev => ({ ...prev, subscriptions: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "subscriptions");
      setLoadedCollections(prev => ({ ...prev, subscriptions: true }));
    });

    // 7. Sync Receivables
    const qRecs = query(collection(db, "receivables"), where("userId", "==", uid));
    const unsubRecs = onSnapshot(qRecs, (snapshot) => {
      const list: Receivable[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          debtor: data.debtor,
          amount: Number(data.amount),
          date: data.date,
          description: data.description,
          reminded: data.reminded ?? false,
        });
      });
      setReceivables(list);
      setLoadedCollections(prev => ({ ...prev, receivables: true }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "receivables");
      setLoadedCollections(prev => ({ ...prev, receivables: true }));
    });

    return () => {
      unsubTasks();
      unsubTrans();
      unsubBills();
      unsubDocs();
      unsubTax();
      unsubSubs();
      unsubRecs();
    };
  }, [user]);

  const handleAddSubscription = async (newSub: Omit<Subscription, "id">) => {
    if (!user) return;
    if (isDemoMode) {
      const subWithId = {
        ...newSub,
        id: `demo-sub-${Date.now()}-${Math.random()}`
      };
      setDemoSubscriptions(prev => [subWithId, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, "subscriptions"), {
        ...newSub,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "subscriptions");
    }
  };

  const handleToggleSubscription = async (id: string, active: boolean) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active } : s));
      return;
    }
    try {
      await updateDoc(doc(db, "subscriptions", id), { active });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${id}`);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoSubscriptions(prev => prev.filter(s => s.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, "subscriptions", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `subscriptions/${id}`);
    }
  };

  const handleAddReceivable = async (newRec: Omit<Receivable, "id" | "reminded">) => {
    if (!user) return;
    if (isDemoMode) {
      const recWithId = {
        ...newRec,
        reminded: false,
        id: `demo-rec-${Date.now()}-${Math.random()}`
      };
      setDemoReceivables(prev => [recWithId, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, "receivables"), {
        ...newRec,
        reminded: false,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "receivables");
    }
  };

  const handleToggleReminded = async (id: string, reminded: boolean) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoReceivables(prev => prev.map(r => r.id === id ? { ...r, reminded } : r));
      return;
    }
    try {
      await updateDoc(doc(db, "receivables", id), { reminded });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receivables/${id}`);
    }
  };

  const handleDeleteReceivable = async (id: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoReceivables(prev => prev.filter(r => r.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, "receivables", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `receivables/${id}`);
    }
  };

  // Clear the derived subscriptions set when context changes
  useEffect(() => {
    derivedSubsRef.current.clear();
  }, [user, isDemoMode]);

  // Automatic subscription derivation from transactions (both live and demo)
  useEffect(() => {
    const activeEntries = isDemoMode ? demoFinanceEntries : financeEntries;
    const activeSubs = isDemoMode ? demoSubscriptions : subscriptions;
    if (activeEntries.length === 0) return;

    const expenses = activeEntries.filter((e) => e.type === "expense");
    const subKeywords = [
      "netflix", "spotify", "aws", "jio", "broadband", "prime", "youtube",
      "icloud", "disney", "hotstar", "adobe", "canva", "github", "chatgpt",
      "openai", "microsoft", "apple", "google one", "sub", "subscription",
      "recurring", "sip", "membership"
    ];

    // Group by normalized description
    const groups: Record<string, typeof activeEntries> = {};
    expenses.forEach((e) => {
      const desc = e.description.trim().toLowerCase();
      if (!groups[desc]) groups[desc] = [];
      groups[desc].push(e);
    });

    const runDerivation = async () => {
      const newSubsToAdd: Omit<Subscription, "id">[] = [];
      const currentNames = new Set([
        ...activeSubs.map(s => s.name.trim().toLowerCase()),
        ...Array.from(derivedSubsRef.current)
      ]);

      for (const [desc, entries] of Object.entries(groups)) {
        const isRecurring = entries.length >= 2;
        const hasKeyword = subKeywords.some((kw) => desc.includes(kw));
        const isUtilityOrSaas = entries[0].category === "utilities" || entries[0].category === "saas";

        if (isRecurring || hasKeyword || isUtilityOrSaas) {
          const normName = entries[0].description.trim().toLowerCase();
          if (!currentNames.has(normName)) {
            // Check if we already scheduled it in this run
            currentNames.add(normName);
            derivedSubsRef.current.add(normName);

            // Sort entries to find the latest
            const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
            const latestDate = new Date(sorted[0].date);
            const today = new Date();
            const diffTime = Math.max(0, today.getTime() - latestDate.getTime());
            const lastUsedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let subCat: Subscription["category"] = "other";
            if (
              desc.includes("netflix") || desc.includes("spotify") ||
              desc.includes("prime") || desc.includes("youtube") ||
              desc.includes("disney") || desc.includes("hotstar")
            ) {
              subCat = "entertainment";
            } else if (
              desc.includes("aws") || desc.includes("adobe") ||
              desc.includes("canva") || desc.includes("github") ||
              desc.includes("chatgpt") || desc.includes("openai") ||
              desc.includes("microsoft")
            ) {
              subCat = "saas";
            } else if (desc.includes("jio") || desc.includes("broadband") || entries[0].category === "utilities") {
              subCat = "utility";
            }

            let frequency: "monthly" | "yearly" = "monthly";
            if (desc.includes("annual") || desc.includes("yearly") || desc.includes("1 year")) {
              frequency = "yearly";
            }

            newSubsToAdd.push({
              name: entries[0].description,
              amount: entries[0].amount,
              frequency,
              category: subCat,
              lastUsedDays,
              active: true,
              isUnused: lastUsedDays >= 14,
            });
          }
        }
      }

      if (newSubsToAdd.length > 0) {
        if (isDemoMode) {
          setDemoSubscriptions((prev) => [
            ...newSubsToAdd.map((s, idx) => ({
              ...s,
              id: `derived-demo-${Date.now()}-${idx}-${Math.random()}`,
            })),
            ...prev,
          ]);
        } else if (user) {
          for (const newSub of newSubsToAdd) {
            try {
              await addDoc(collection(db, "subscriptions"), {
                ...newSub,
                userId: user.uid,
              });
            } catch (err) {
              console.error("Error adding derived subscription:", err);
            }
          }
        }
      }
    };

    runDerivation();
  }, [user, isDemoMode, financeEntries, demoFinanceEntries, subscriptions, demoSubscriptions]);

  // Firestore mutations
  const handleToggleTask = async (id: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
      return;
    }
    const taskItem = tasks.find((t) => t.id === id);
    if (taskItem) {
      try {
        await updateDoc(doc(db, "tasks", id), {
          completed: !taskItem.completed,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
      }
    }
  };

  const handleAddTask = async (newTask: Omit<Task, "id" | "completed">) => {
    if (!user) return;
    if (isDemoMode) {
      const newTaskWithId = {
        ...newTask,
        completed: false,
        id: `demo-task-${Date.now()}`
      };
      setDemoTasks(prev => [newTaskWithId, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, "tasks"), {
        ...newTask,
        completed: false,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tasks");
    }
  };

  const handleUpdateTask = async (id: string, updated: Partial<Task>) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      return;
    }
    try {
      await updateDoc(doc(db, "tasks", id), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoTasks(prev => prev.filter(t => t.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const handleAddFinance = async (newEntry: Omit<FinanceEntry, "id" | "date">) => {
    if (!user) return;
    if (isDemoMode) {
      const newEntryWithId = {
        ...newEntry,
        id: `demo-fin-${Date.now()}`,
        date: new Date().toISOString().split("T")[0]
      };
      setDemoFinanceEntries(prev => [newEntryWithId, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, "transactions"), {
        ...newEntry,
        date: new Date().toISOString().split("T")[0],
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "transactions");
    }
  };

  const handleMarkBillPaid = async (id: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoBills(prev => prev.map(b => b.id === id ? { ...b, paid: true } : b));
      const billItem = demoBills.find((b) => b.id === id);
      if (billItem) {
        await handleAddFinance({
          description: `paid bill: ${billItem.payee}`,
          amount: billItem.amount,
          type: "expense",
          category: "utilities",
        });
      }
      return;
    }
    try {
      await updateDoc(doc(db, "bills", id), { paid: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${id}`);
    }

    // Auto-log bill paid inside transactions
    const billItem = bills.find((b) => b.id === id);
    if (billItem) {
      await handleAddFinance({
        description: `paid bill: ${billItem.payee}`,
        amount: billItem.amount,
        type: "expense",
        category: "utilities",
      });
    }
  };

  const handleAddBill = async (newBill: Omit<Bill, "id" | "paid">) => {
    if (!user) return;
    if (isDemoMode) {
      const newBillWithId = {
        ...newBill,
        paid: false,
        id: `demo-bill-${Date.now()}`
      };
      setDemoBills(prev => [newBillWithId, ...prev]);

      // Auto-schedule task for due date
      await handleAddTask({
        title: `pay bill: ${newBill.payee}`,
        dueDate: newBill.dueDate,
        category: "finance",
        priority: "medium",
      });
      return;
    }
    try {
      await addDoc(collection(db, "bills"), {
        ...newBill,
        paid: false,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "bills");
    }

    // Auto-schedule task for due date
    await handleAddTask({
      title: `pay bill: ${newBill.payee}`,
      dueDate: newBill.dueDate,
      category: "finance",
      priority: "medium",
    });
  };

  const handleUpdateTaxProfile = async (gross: number, c80: number, d80: number, extra?: any) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoTaxProfile({
        grossIncome: gross,
        deduction80C: c80,
        deduction80D: d80,
        hraReceived: extra?.hraReceived ?? 0,
        homeLoanInterest: extra?.homeLoanInterest ?? 0,
        deduction80CCD: extra?.deduction80CCD ?? 0,
        deduction80E: extra?.deduction80E ?? 0,
        deduction80G: extra?.deduction80G ?? 0,
      });
      return;
    }
    try {
      await setDoc(doc(db, "taxProfile", user.uid), {
        grossIncome: gross,
        deduction80C: c80,
        deduction80D: d80,
        hraReceived: extra?.hraReceived ?? 0,
        homeLoanInterest: extra?.homeLoanInterest ?? 0,
        deduction80CCD: extra?.deduction80CCD ?? 0,
        deduction80E: extra?.deduction80E ?? 0,
        deduction80G: extra?.deduction80G ?? 0,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `taxProfile/${user.uid}`);
    }
  };

  const handleAddDocument = async (
    name: string,
    size: string,
    type: string,
    category?: string,
    tags?: string[],
    summary?: string
  ) => {
    if (!user) return;
    if (isDemoMode) {
      const newDoc: Document = {
        id: `demo-doc-${Date.now()}`,
        userId: "demo-user",
        fileName: name,
        fileType: category || "General",
        storageUrl: `https://example.com/demo/${name}`,
        uploadedAt: new Date().toISOString(),
        status: "imported",
        extractedData: {
          summary: summary || "financial statement processed by finia intelligence."
        },
        confidenceFlags: {},
        size,
        tags: tags || []
      };
      setDemoDocuments(prev => [newDoc, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, "documents"), {
        userId: user.uid,
        fileName: name,
        fileType: category || "General",
        storageUrl: `https://example.com/uploads/${user.uid}/${name}`,
        uploadedAt: new Date().toISOString(),
        status: "imported",
        extractedData: {
          summary: summary || "financial statement processed by finia intelligence."
        },
        confidenceFlags: {},
        size,
        tags: tags || []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "documents");
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!user) return;
    const demoData = {
      bills: demoBills,
      transactions: demoFinanceEntries,
      tasks: demoTasks,
      payslips: [],
      deductions: []
    };
    const liveData = {
      bills: bills,
      transactions: financeEntries,
      tasks: tasks,
      payslips: [],
      deductions: []
    };
    const dataToCheck = isDemoMode ? demoData : liveData;

    try {
      const summaryResult = await getDeletionSummary(id, true, isDemoMode, dataToCheck);
      
      const confirmBoth = window.confirm(
        `${summaryResult.summary}\n\nClick "OK" to delete the document AND all its derived records (Cascade Delete).\nClick "Cancel" to choose data-only deletion or cancel.`
      );

      if (confirmBoth) {
        const demoActions = {
          onDeleteDemoDoc: (docId: string) => {
            setDemoDocuments(prev => prev.filter(d => d.id !== docId));
          },
          onDeleteDemoDerived: (docId: string) => {
            setDemoBills(prev => prev.filter(b => b.sourceDocumentId !== docId));
            setDemoFinanceEntries(prev => prev.filter(t => t.sourceDocumentId !== docId));
            setDemoTasks(prev => prev.filter(t => t.sourceDocumentId !== docId));
          }
        };
        await deleteDocumentAndData(id, isDemoMode, demoActions);
        alert("Document and all derived records deleted successfully.");
      } else {
        const confirmDataOnly = window.confirm(
          "Do you want to delete ONLY the derived records but keep the document file in your library?"
        );
        if (confirmDataOnly) {
          const demoActions = {
            onUpdateDemoDocStatus: (docId: string, status: string) => {
              setDemoDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: status as any } : d));
            },
            onDeleteDemoDerived: (docId: string) => {
              setDemoBills(prev => prev.filter(b => b.sourceDocumentId !== docId));
              setDemoFinanceEntries(prev => prev.filter(t => t.sourceDocumentId !== docId));
              setDemoTasks(prev => prev.filter(t => t.sourceDocumentId !== docId));
            }
          };
          await deleteDataOnly(id, isDemoMode, demoActions);
          alert("Derived data deleted. The document file has been kept in your library (marked 'data_removed').");
        }
      }
    } catch (error: any) {
      console.error("Error in handleDeleteDocument:", error);
      alert("Failed to delete: " + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("onboarding_completed");
      setOnboardingCompleted(false);
      setView("dashboard");
    } catch (err) {
      console.error("Sign Out Error: ", err);
    }
  };

  const handleQuickAddTask = () => {
    setView("tasks");
  };

  // Render Correct View
  const renderViewContent = () => {
    const activeTasks = isDemoMode ? demoTasks : tasks;
    const activeFinanceEntries = isDemoMode ? demoFinanceEntries : financeEntries;
    const activeBills = isDemoMode ? demoBills : bills;
    const activeDocuments = isDemoMode ? demoDocuments : documents;
    const activeTaxProfile = isDemoMode ? demoTaxProfile : taxProfile;
    const activeSubscriptions = isDemoMode ? demoSubscriptions : subscriptions;
    const activeReceivables = isDemoMode ? demoReceivables : receivables;

    switch (activeView) {
      case "dashboard":
        return (
          <DashboardView
            tasks={activeTasks}
            financeEntries={activeFinanceEntries}
            bills={activeBills}
            subscriptions={activeSubscriptions}
            receivables={activeReceivables}
            taxProfile={activeTaxProfile}
            setView={setView}
            onToggleComplete={handleToggleTask}
            onAddTask={handleAddTask}
            onAddBill={handleAddBill}
            onAddFinance={handleAddFinance}
            onClearData={() => setIsClearModalOpen(true)}
            isDemoMode={isDemoMode}
            onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
            onFiniaPromptAction={(query) => {
              setChatInitialQuery(query);
              setChatOpen(true);
            }}
          />
        );
      case "tasks":
        return (
          <TasksView
            tasks={activeTasks}
            onToggleComplete={handleToggleTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleUpdateTask}
          />
        );
      case "calendar":
        return <CalendarView tasks={activeTasks} bills={activeBills} />;
      case "finance":
        return (
          <FinanceView
            financeEntries={activeFinanceEntries}
            onAddFinanceEntry={handleAddFinance}
            subscriptions={activeSubscriptions}
            receivables={activeReceivables}
            onAddSubscription={handleAddSubscription}
            onToggleSubscription={handleToggleSubscription}
            onDeleteSubscription={handleDeleteSubscription}
            onAddReceivable={handleAddReceivable}
            onToggleReminded={handleToggleReminded}
            onDeleteReceivable={handleDeleteReceivable}
          />
        );
      case "bills":
        return (
          <BillsView
            bills={activeBills}
            financeEntries={activeFinanceEntries}
            onMarkPaid={handleMarkBillPaid}
            onAddBill={handleAddBill}
            onAddTask={handleAddTask}
            onAddDocument={handleAddDocument}
          />
        );
      case "tax":
        return (
          <TaxView
            grossIncomeProp={activeTaxProfile.grossIncome}
            deduction80CProp={activeTaxProfile.deduction80C}
            deduction80DProp={activeTaxProfile.deduction80D}
            hraReceivedProp={activeTaxProfile.hraReceived}
            homeLoanInterestProp={activeTaxProfile.homeLoanInterest}
            deduction80CCDProp={activeTaxProfile.deduction80CCD}
            deduction80EProp={activeTaxProfile.deduction80E}
            deduction80GProp={activeTaxProfile.deduction80G}
            onUpdateTaxProfile={handleUpdateTaxProfile}
            documents={activeDocuments}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        );
      case "documents":
        return (
          <DocumentsView
            files={activeDocuments}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        );
      case "analytics":
        return <AnalyticsView financeEntries={activeFinanceEntries} />;
      default:
        return (
          <DashboardView
            tasks={activeTasks}
            financeEntries={activeFinanceEntries}
            bills={activeBills}
            subscriptions={activeSubscriptions}
            receivables={activeReceivables}
            taxProfile={activeTaxProfile}
            setView={setView}
            onToggleComplete={handleToggleTask}
            isDemoMode={isDemoMode}
            onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
            onFiniaPromptAction={(query) => {
              setChatInitialQuery(query);
              setChatOpen(true);
            }}
          />
        );
    }
  };

  const collectionsLoading = (user && !isDemoMode) ? (
    !loadedCollections.tasks || 
    !loadedCollections.transactions || 
    !loadedCollections.bills || 
    !loadedCollections.documents || 
    !loadedCollections.taxProfile ||
    !loadedCollections.subscriptions ||
    !loadedCollections.receivables
  ) : false;

  const renderLoadingSkeleton = () => {
    return (
      <div className="space-y-6 animate-pulse text-left">
        {/* Tally cards row skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-28 flex flex-col justify-between shadow-sm">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-28 flex flex-col justify-between shadow-sm">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-28 flex flex-col justify-between shadow-sm">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 h-28 flex flex-col justify-between shadow-sm">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
        </div>

        {/* Large content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-96 space-y-4 shadow-sm">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-6"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-96 space-y-4 flex flex-col justify-between shadow-sm">
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-6"></div>
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                </div>
              </div>
            </div>
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  };

  // 1. Auth Loading State Screen
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1528] to-[#1B3A6B] text-white">
        <div className="w-12 h-12 border-4 border-[#2BA8E0] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest font-mono text-slate-400">
          initializing finia engine...
        </span>
      </div>
    );
  }

  // 2. Onboarding Flow (Unauthenticated or first-time user)
  if (!onboardingCompleted) {
    return (
      <Onboarding
        user={user}
        onComplete={(demoMode) => {
          if (demoMode) {
            setIsDemoMode(true);
            setUser({ uid: "demo-user", email: "demo@finia.ai", displayName: "Demo User" } as User);
          }
          localStorage.setItem("onboarding_completed", "true");
          setOnboardingCompleted(true);
          setView("dashboard");
        }}
      />
    );
  }

  // 3. Unauthenticated Fallback (Security double-check)
  if (!user) {
    return <SignIn onSignInSuccess={() => setView("dashboard")} />;
  }

  // Crisis Mode Full-Screen Dark Takeover
  if (activeView === "crisis") {
    return (
      <CrisisModeView
        tasks={tasks}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onAddTask={handleAddTask}
        onClose={() => setView("dashboard")}
      />
    );
  }

  // 3. Fully Authenticated Workspace App Screen
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F3F4F6] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* Left Sidebar for Desktop */}
      <Sidebar
        activeView={activeView}
        setView={setView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 pb-16 md:pb-0 overflow-hidden">
        {/* Top Header */}
        <TopBar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          setView={setView}
          onQuickAddTask={handleQuickAddTask}
          displayName={user.displayName || user.email || "jkkoivila"}
          photoURL={user.photoURL || undefined}
          onSignOut={handleSignOut}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onClearData={() => setIsClearModalOpen(true)}
          isDemoMode={isDemoMode}
          onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
        />

        {/* Dynamic Inner Stage View */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-[#F3F4F6] dark:bg-[#070b13]">
          <div className="max-w-6xl mx-auto">
            {collectionsLoading ? renderLoadingSkeleton() : renderViewContent()}
          </div>
        </div>
      </div>

      {/* Floating Agent Chat Assistant */}
      <ChatAgent
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        tasks={isDemoMode ? demoTasks : tasks}
        bills={isDemoMode ? demoBills : bills}
        financeEntries={isDemoMode ? demoFinanceEntries : financeEntries}
        taxProfile={isDemoMode ? demoTaxProfile : taxProfile}
        onAddTask={handleAddTask}
        initialQuery={chatInitialQuery}
        clearInitialQuery={() => setChatInitialQuery(null)}
      />

      {/* Bottom Tabs for Mobile screens */}
      <MobileTabs
        activeView={activeView}
        setView={setView}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
      />

      {/* Clear Database Data Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Clear all database data?
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This action will permanently delete all your logged tasks, transactions, bills, and uploaded documents from the live Firestore database. Your tax profile configurations will also be reset to zero. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={clearingInProgress}
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                disabled={clearingInProgress}
                onClick={handleClearAllData}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none shadow-sm shadow-red-200 dark:shadow-none"
              >
                {clearingInProgress ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Wiping...</span>
                  </>
                ) : (
                  <span>Yes, Clear All Data</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
