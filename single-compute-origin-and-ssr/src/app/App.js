import React from 'react';

import Container from './Container.js';

import { Counter } from './Counter.js';
import { Counter as Counter2 } from './Counter2.js';
import AsyncModule from './cjs/Counter3.js';
const Counter3 = await(AsyncModule);

import ShowMore from './ShowMore.js';
import Button from './Button.js';
import Form from './Form.js';

import { Dynamic } from './Dynamic.js';
import { Client } from './Client.js';

import { Note } from './cjs/Note.js';

import { greet, like, increment } from './actions.js';

import { getServerState } from './ServerState.js';
import { fetchTodos } from './todos.js';

export default async function App() {
  const res = await fetchTodos();
  const todos = await res.json();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flight</title>
      </head>
      <body>
        <Container>
          <h1>{await getServerState()}</h1>
          <Counter incrementAction={increment} />
          <Counter2 incrementAction={increment} />
          <Counter3 incrementAction={increment} />
          <ul>
            {todos.map(todo => (
              <li key={todo.id}>{todo.text}</li>
            ))}
          </ul>
          <ShowMore>
            <p>Lorem ipsum</p>
          </ShowMore>
          <Form action={greet} />
          <div>
            <Button action={like}>Like</Button>
          </div>
          <div>
            loaded statically: <Dynamic />
          </div>
          <Client />
          <Note />
        </Container>
      </body>
    </html>
  );
}
