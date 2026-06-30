import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function SurveyPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { lead } = useAuth();
  const [surveyCompleted, setSurveyCompleted] = useState(false);

  useEffect(() => {
    const handleSurveySubmit = (event) => {
      if (event.data?.type === 'survey-completed') {
        setSurveyCompleted(true);
        setTimeout(() => {
          navigate(`/e/${slug}`, { replace: true });
        }, 500);
      }
    };

    window.addEventListener('message', handleSurveySubmit);
    return () => window.removeEventListener('message', handleSurveySubmit);
  }, [slug, navigate]);

  const spotFormUrl = import.meta.env.VITE_SPOT_FORM_URL || '';

  return (
    <div className="survey-page">
      <main className="survey-container">
        {!surveyCompleted ? (
          <>
            <header className="survey-header">
              <h1>Vamos começar!</h1>
              <p>Responda algumas perguntas para personalizarmos sua jornada</p>
            </header>

            <div className="survey-embed">
              {spotFormUrl ? (
                <iframe
                  src={spotFormUrl}
                  title="Pesquisa de Personalização"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  allow="payment"
                />
              ) : (
                <div className="survey-placeholder">
                  <p>⏳ Carregando pesquisa...</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="survey-success">
            <p>✓ Obrigado! Redirecionando...</p>
          </div>
        )}
      </main>

      <style>{`
        .survey-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 1rem;
        }

        .survey-container {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .survey-header {
          text-align: center;
          color: #fff;
        }

        .survey-header h1 {
          font-size: 1.5rem;
          margin: 0 0 0.5rem;
          font-weight: 600;
        }

        .survey-header p {
          margin: 0;
          font-size: 0.95rem;
          opacity: 0.8;
        }

        .survey-embed {
          width: 100%;
          height: 500px;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .survey-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-size: 1rem;
        }

        .survey-success {
          text-align: center;
          padding: 2rem;
          color: #4ade80;
          font-size: 1.1rem;
        }

        @media (max-width: 480px) {
          .survey-page {
            min-height: calc(100vh - env(safe-area-inset-bottom));
          }

          .survey-embed {
            height: 600px;
          }

          .survey-header h1 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
