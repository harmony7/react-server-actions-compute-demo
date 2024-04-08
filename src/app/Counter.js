'use client';

import React, { useActionState } from 'react';

import Container from './Container.js';

export function Counter({incrementAction}) {
  const [count, incrementFormAction, isPending] = useActionState(incrementAction, 0);
  return (
    <Container>
      <form>
        <button formAction={incrementFormAction} disabled={isPending}>Count: {count}</button>
      </form>
    </Container>
  );
}
