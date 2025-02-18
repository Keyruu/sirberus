import { useState } from 'react';
import './App.css';

function App() {
	const [count, setCount] = useState(0);

	return (
		<>
			<div className="text-gray-500 dark:text-gray-400">
				<h1 className="text-4xl font-extrabold leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
					Vite + React
				</h1>
				<div className="py-3">
					<button
						className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
						onClick={() => setCount(count => count + 1)}
					>
						count is {count}
					</button>
				</div>
			</div>
		</>
	);
}

export default App;
