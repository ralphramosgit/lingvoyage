import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { LessonCompleteView } from '@/components/lesson/LessonComplete';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { QuizNotFound } from '@/components/quiz/QuizNotFound';
import type { Unit } from '@/content/lessons/types';
import { findUnit } from '@/content/lessons/units';
import { findQuiz } from '@/content/quizzes/quizzes';
import type { Quiz } from '@/content/quizzes/types';
import { stopPlayback } from '@/lib/audio';
import { shuffled } from '@/lib/lessons';

function exitToQuizzes() {
  stopPlayback();
  if (router.canGoBack()) router.back();
  else router.replace('/quiz');
}

export default function QuizPlayerScreen() {
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const quiz = findQuiz(quizId);
  // Bumped by "Try again", which starts the quiz over with the questions in a new order.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => () => stopPlayback(), []);

  if (!quiz || quiz.exercises.length === 0) return <QuizNotFound />;
  return (
    <QuizFlow
      key={`${quiz.id}/${attempt}`}
      quiz={quiz}
      onTryAgain={() => {
        stopPlayback();
        setAttempt((count) => count + 1);
      }}
    />
  );
}

function QuizFlow({ quiz, onTryAgain }: { quiz: Quiz; onTryAgain: () => void }) {
  // A new order every time, with any match-the-pairs first as a warm-up, like a checkpoint.
  // Picked once, so the questions don't reshuffle while the learner is answering them.
  const [exercises] = useState(() => {
    const order = shuffled(quiz.exercises);
    return [...order.filter((exercise) => exercise.kind === 'match'), ...order.filter((exercise) => exercise.kind !== 'match')];
  });
  const unit = findUnit(quiz.unitId);

  const reviewUnit = (target: Unit) => {
    stopPlayback();
    router.replace({ pathname: '/unit/[unitId]', params: { unitId: target.id } });
  };

  return (
    <LessonPlayer
      title={quiz.title}
      exercises={exercises}
      exitHint="Goes back to the quizzes"
      onExit={exitToQuizzes}
      // Scores aren't saved yet: that comes with the real quizzes.
      onFinished={() => undefined}
      renderDone={({ firstTry, total, bottomInset }) => (
        <LessonCompleteView heading="Quiz done!" title={quiz.title} firstTry={firstTry} total={total} bottomInset={bottomInset}>
          <Button label="Try again" icon={RotateCcw} onPress={onTryAgain} />
          {unit ? <Button label="Review the unit" icon={BookOpen} variant="secondary" onPress={() => reviewUnit(unit)} /> : null}
          <Button label="Back to quizzes" icon={ArrowLeft} variant="ghost" size="md" onPress={exitToQuizzes} />
        </LessonCompleteView>
      )}
    />
  );
}
