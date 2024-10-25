"use client"
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app, auth as firebaseAuth } from '../config';
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react";
import CircularProgress from '@mui/material/CircularProgress';
import SignOutButton from "../components/SignOutButton";
import LargeText from "../components/LargeText";
import SmallText from "../components/SmallText";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = "https://ynpmurabzuiktqholsyy.supabase.co"; // Replace with your Supabase URL
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucG11cmFienVpa3RxaG9sc3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MDA0MDAsImV4cCI6MjA0MjE3NjQwMH0.xy7qtMhId1Wf4SqoQeCQwfOIbVKzw8ZHJiGM2IPmQf8"; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);

  const fetchBackendData = async (accessToken) => {
    try {
      const response = await fetch("/backend/python", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const responseData = await response.json();
      setData(responseData.message);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleUserJoin = async (userId) => {
    await supabase.from("page_sessions").insert([{ user_id: userId, status: true }]);
  };

  const handleUserLeave = async (userId) => {
    await supabase.from("page_sessions").update({ status: false }).eq("user_id", userId);
  };

  const subscribeToUserCount = () => {
    const channel = supabase
      .channel("online-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "page_sessions" }, (payload) => {
        fetchActiveUsers();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const fetchActiveUsers = async () => {
    const { data } = await supabase.from("page_sessions").select("user_id").eq("status", true);
    setUserCount(data.length);
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await handleUserJoin(currentUser.uid);
        fetchBackendData(currentUser.accessToken);
        const unsubscribeChannel = subscribeToUserCount();
        return () => unsubscribeChannel();
      } else {
        router.push("/signin");
      }
    });

    return () => {
      if (user) handleUserLeave(user.uid);
      unsubscribe();
    };
  }, []);

  if (!user || loading) {
    return (
      <>
        <CircularProgress color="secondary" size={"3em"} />
      </>
    );
  }

  return (
    <>
      <LargeText value={`Hi ${user.displayName}`} />
      <SmallText value={`Users online: ${userCount}/16`} />
      <SmallText value={data} />
      <SignOutButton />
    </>
  );
}