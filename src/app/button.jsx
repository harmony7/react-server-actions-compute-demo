"use client";

import { useState, useTransition } from 'react';

export function Button({ initialValue, action }) {
  const [isPending, startTransition] = useTransition();
  const [likeCount, setLikeCount] = useState(initialValue);

  const onClick = () => {
    startTransition(async () => {
      const currentCount = await action();
      setLikeCount(currentCount);
    });
  };

  return (
    <>
      <p>Total Likes: {likeCount}</p>
      <button onClick={onClick} disabled={isPending}>Like</button>
    </>
  );
}
