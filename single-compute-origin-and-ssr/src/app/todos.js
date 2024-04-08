export async function fetchTodos() {
  const todos = [
    {
      id: 1,
      text: 'Shave yaks',
    },
    {
      id: 2,
      text: 'Eat kale',
    },
  ];

  return new Response(
    JSON.stringify(todos),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/json',
      },
    },
  );
}
