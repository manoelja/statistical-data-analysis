import type { ReactNode } from 'react';

interface QuestionCardProps {
  id: string;
  tag: string;
  title: string;
  prompt: ReactNode;
  children: ReactNode;
}

export function QuestionCard({ id, tag, title, prompt, children }: QuestionCardProps) {
  return (
    <article className="qcard" id={id}>
      <div className="qcard__head">
        <span className="qcard__tag">{tag}</span>
        <h3>{title}</h3>
        <p className="qcard__prompt">{prompt}</p>
      </div>
      <div className="qcard__body">{children}</div>
    </article>
  );
}
