import { useState, useEffect } from 'react'
import HomePage from '../routes/index.jsx'
import ClearClausePage from '../routes/clearclause/index.jsx'

function App() {
    const [currentPath, setCurrentPath] = useState(window.location.pathname)

    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname)
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    const navigate = (path) => {
        window.history.pushState({}, '', path)
        setCurrentPath(path)
    }

    const renderRoute = () => {
        switch (currentPath) {
            case '/':
                return (
                    <div>
                        <HomePage />
                        <nav className="mt-4 p-4">
                            <button
                                onClick={() => navigate('/clearclause')}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Go to ClearClause Test
                            </button>
                        </nav>
                    </div>
                )
            case '/clearclause':
                return (
                    <div>
                        <ClearClausePage />
                        <nav className="mt-4 p-4">
                            <button
                                onClick={() => navigate('/')}
                                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Go to Home
                            </button>
                        </nav>
                    </div>
                )
            default:
                return <div className="p-6">404 - Page not found</div>
        }
    }

    return <div>{renderRoute()}</div>
}

export default App