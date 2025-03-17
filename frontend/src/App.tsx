import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { fetchTasks, addTask, toggleTask, deleteTask } from "./taskSlice";

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tasks, loading, error } = useSelector((state: RootState) => state.tasks);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    dispatch(addTask(newTask));
    setNewTask("");
  };

  return (
    <div>
      <h1>To-Do List</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      
      <label>
        New Task:{" "}
        <input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="Enter a task"
        />
      </label>
      <button onClick={handleAddTask} disabled={!newTask.trim()}>
        Add
      </button>

      {loading ? (
        <p>Loading tasks...</p>
      ) : (
        <ul>
          {tasks.map(task => (
            <li key={task.id} style={{ textDecoration: task.completed ? "line-through" : "none" }}>
              <span onClick={() => dispatch(toggleTask({ id: task.id, completed: task.completed }))}>
                {task.title}
              </span>
              <button onClick={() => dispatch(deleteTask(task.id))}>❌</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
