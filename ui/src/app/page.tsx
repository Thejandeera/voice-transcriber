import { ChatInterface } from '@/components/organisms/ChatInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-12 bg-black text-white">
      <div className="mb-8 text-center">
        
        <p className="text-gray-400">Autonomous Business Intake Agent</p>
      </div>
      
      <ChatInterface />
    </main>
  );
}