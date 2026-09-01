import type { Faq } from '../model/types';

export const FaqList = ({ items }: { items: readonly Faq[] }) => (
  <div className="seo-faq">
    {items.map((item) => (
      <details key={item.question}>
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
      </details>
    ))}
  </div>
);
