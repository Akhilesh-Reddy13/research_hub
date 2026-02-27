import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const phrases = [
  "Summarizing 50+ papers in seconds...",
  "Finding gaps in Transformer architectures...",
  "Extracting key findings from PDFs...",
  "Comparing methodologies across studies...",
  "Building your knowledge graph...",
  "Analyzing citation networks...",
];

export default function TypewriterEffect() {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Start with first phrase fully displayed
  const [displayText, setDisplayText] = useState(phrases[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);

  useEffect(() => {
    // Initial wait before starting to delete first phrase
    if (isWaiting) {
      const waitTimeout = setTimeout(() => {
        setIsWaiting(false);
        setIsDeleting(true);
      }, 2000);
      return () => clearTimeout(waitTimeout);
    }

    const currentPhrase = phrases[currentIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentPhrase.length) {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % phrases.length);
        }
      }
    }, isDeleting ? 30 : 60);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex, isWaiting]);

  return (
    <div className="min-h-[80px]">
      <span className="text-2xl md:text-3xl font-light text-blue-200">
        {displayText}
        <motion.span
          className="inline-block w-[3px] h-8 bg-blue-400 ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        />
      </span>
    </div>
  );
}
