"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ReactMarkdown from 'react-markdown';

export default function RoadmapPage() {
  const { user, isAuthenticated, isLoading, isMaster, token } = useAuth();
  const router = useRouter();
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (!isMaster) {
        router.push('/');
        return;
      }

      if (!token) {
        console.error('No authentication token available');
        router.push('/login');
        return;
      }

      // Load the markdown file
      fetch('/api/roadmap', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            console.error('Error loading roadmap:', data.error);
            router.push('/');
            return;
          }
          setMarkdown(data.content);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load roadmap:', err);
          setLoading(false);
        });
    }
  }, [isAuthenticated, isLoading, isMaster, token, router]);

  if (isLoading || loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="max-w-5xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="prose prose-slate dark:prose-invert max-w-none
          prose-headings:font-bold dark:prose-headings:text-white
          prose-h1:text-3xl prose-h1:border-b prose-h1:pb-2
          prose-h2:text-2xl prose-h2:mt-8
          prose-h3:text-xl prose-h3:mt-6
          prose-p:text-base prose-p:leading-7 dark:prose-p:text-gray-100
          prose-li:text-inherit dark:prose-li:text-gray-100
          prose-ul:list-disc prose-ul:ml-6
          prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline
          prose-strong:font-semibold dark:prose-strong:text-white
          prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg
          prose-hr:my-8
          prose-table:border-collapse
          prose-th:border prose-th:p-2 prose-th:bg-muted
          prose-td:border prose-td:p-2 dark:prose-td:text-gray-100">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
