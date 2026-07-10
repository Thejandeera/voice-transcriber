export const ChatBubble = ({ role, content }: { role: 'user' | 'ai'; content: string }) => {
  const isUser = role === 'user';
  return (
    <div className={`max-w-[80%] p-4 rounded-xl shadow-md ${isUser ? 'bg-blue-600 text-white self-end rounded-br-sm' : 'bg-gray-800 text-gray-100 self-start rounded-bl-sm'}`}>
      <p className="text-sm md:text-base leading-relaxed">{content}</p>
    </div>
  );
};