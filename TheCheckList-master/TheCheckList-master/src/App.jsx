import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import VoiceRecorder from './components/VoiceRecorder';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Brain className="h-10 w-10 text-indigo-600" />
                <Sparkles className="h-4 w-4 text-pink-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  VoiceGenius
                </h1>
                <p className="text-sm text-gray-600">Your AI Meeting Assistant</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-4 text-sm">
              <a href="#features" className="text-gray-600 hover:text-indigo-600 transition-colors">Features</a>
              <a href="#about" className="text-gray-600 hover:text-indigo-600 transition-colors">About</a>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transform Your Meetings with AI
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Capture every important detail while staying fully engaged in your conversations.
            Let AI handle the note-taking for you.
          </p>
        </div>

        <VoiceRecorder />

        <section id="features" className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'Real-Time Transcription',
              description: 'Instantly convert speech to text with high accuracy',
              image: 'https://images.unsplash.com/photo-1589652717521-10c0d092dea9?auto=format&fit=crop&w=800&q=80'
            },
            {
              title: 'Smart Action Items',
              description: 'Automatically extract tasks and deadlines from conversations',
              image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80'
            },
            {
              title: 'Meeting Insights',
              description: 'Get AI-powered summaries and key discussion points',
              image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=80'
            }
          ].map((feature, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="h-48 overflow-hidden">
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-indigo-600" />
                <span className="font-bold text-gray-900">VoiceGenius</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Transforming the way professionals handle meetings with AI-powered assistance.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#features" className="hover:text-indigo-600">Features</a></li>
                <li><a href="#about" className="hover:text-indigo-600">About</a></li>
                <li><a href="#privacy" className="hover:text-indigo-600">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
              <p className="text-sm text-gray-600">
                Questions? Reach out to us at support@voicegenius.ai
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
            © 2024 VoiceGenius. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 