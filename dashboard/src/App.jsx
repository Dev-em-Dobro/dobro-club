import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import EventHome from './pages/EventHome.jsx';
import LinkInvalido from './pages/LinkInvalido.jsx';
import SurveyPage from './pages/SurveyPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<EventHome />} />
          <Route path="/pesquisa/:slug" element={<SurveyPage />} />
          <Route path="/e/:slug" element={<EventHome />} />
          <Route path="/link-invalido" element={<LinkInvalido />} />
          <Route path="*" element={<LinkInvalido />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
