import { useState } from 'react'
import '../../styles/theme.css'
import '../../styles/cards.css'

const ComparisonResults = ({ documents = [] }) => {
  const [activeView, setActiveView] = useState('overview') // overview, detailed, risks

  // Mock comparison data
  const comparisonData = {
    overview: {
      totalDocuments: documents.length || 3,
      keyDifferences: 12,
      riskVariations: 8,
      commonTerms: 45,
      uniqueClauses: 6
    },
    keyDifferences: [
      {
        category: 'Termination Clauses',
        document1: 'Company may terminate with 30 days notice',
        document2: 'Either party may terminate with 14 days notice',
        document3: 'Immediate termination allowed for breach',
        riskLevel: 'High',
        impact: 'Significant variation in termination rights'
      },
      {
        category: 'Liability Limitations',
        document1: 'Limited to $10,000 maximum',
        document2: 'No liability limitations specified',
        document3: 'Limited to contract value',
        riskLevel: 'Critical',
        impact: 'Major differences in liability exposure'
      },
      {
        category: 'Payment Terms',
        document1: 'Net 30 days payment terms',
        document2: 'Net 15 days payment terms',
        document3: 'Payment due upon receipt',
        riskLevel: 'Medium',
        impact: 'Cash flow implications vary significantly'
      },
      {
        category: 'Intellectual Property',
        document1: 'All IP remains with creator',
        document2: 'Shared IP ownership model',
        document3: 'IP transfers to client',
        riskLevel: 'High',
        impact: 'Fundamental differences in IP ownership'
      },
      {
        category: 'Dispute Resolution',
        document1: 'Binding arbitration required',
        document2: 'Court litigation allowed',
        document3: 'Mediation first, then arbitration',
        riskLevel: 'Medium',
        impact: 'Different approaches to conflict resolution'
      }
    ],
    riskAnalysis: [
      {
        riskType: 'Financial Risk',
        document1: 'Low',
        document2: 'High',
        document3: 'Medium',
        details: 'Liability and payment term variations create different financial exposures'
      },
      {
        riskType: 'Legal Risk',
        document1: 'Medium',
        document2: 'High',
        document3: 'Low',
        details: 'Termination and dispute resolution clauses vary significantly'
      },
      {
        riskType: 'Operational Risk',
        document1: 'Low',
        document2: 'Medium',
        document3: 'High',
        details: 'Different performance and delivery requirements'
      },
      {
        riskType: 'IP Risk',
        document1: 'Low',
        document2: 'High',
        document3: 'Medium',
        details: 'Intellectual property ownership varies across documents'
      }
    ]
  }

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'var(--accent-red)'
      case 'high': return 'var(--accent-orange)'
      case 'medium': return 'var(--accent-yellow)'
      case 'low': return 'var(--accent-emerald)'
      default: return 'var(--gray-500)'
    }
  }

  const getRiskBg = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'rgba(239, 68, 68, 0.1)'
      case 'high': return 'rgba(249, 115, 22, 0.1)'
      case 'medium': return 'rgba(234, 179, 8, 0.1)'
      case 'low': return 'rgba(34, 197, 94, 0.1)'
      default: return 'var(--gray-100)'
    }
  }

  const renderTabNavigation = () => (
    <div style={{
      display: 'flex',
      background: 'white',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-1)',
      border: '1px solid var(--gray-200)',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 'var(--space-6)',
      gap: 'var(--space-1)'
    }}>
      {[
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'detailed', label: 'Key Differences', icon: '⚖️' },
        { id: 'risks', label: 'Risk Analysis', icon: '⚠️' }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveView(tab.id)}
          style={{
            flex: 1,
            padding: 'var(--space-3) var(--space-4)',
            border: 'none',
            borderRadius: 'var(--radius)',
            background: activeView === tab.id ? 'var(--primary)' : 'transparent',
            color: activeView === tab.id ? 'white' : 'var(--gray-600)',
            fontWeight: activeView === tab.id ? '600' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all var(--duration-200) var(--ease-out)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)'
          }}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)'
      }}>
        {[
          { label: 'Documents Compared', value: comparisonData.overview.totalDocuments, icon: '📄', color: 'var(--gradient-primary)' },
          { label: 'Key Differences', value: comparisonData.overview.keyDifferences, icon: '⚖️', color: 'var(--gradient-warning)' },
          { label: 'Risk Variations', value: comparisonData.overview.riskVariations, icon: '⚠️', color: 'var(--gradient-danger)' },
          { label: 'Common Terms', value: comparisonData.overview.commonTerms, icon: '✓', color: 'var(--gradient-success)' }
        ].map((stat, index) => (
          <div
            key={index}
            style={{
              padding: 'var(--space-4)',
              background: 'white',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--gray-200)',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              background: stat.color,
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-3)',
              fontSize: '20px',
              color: 'white'
            }}>
              {stat.icon}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '800',
              background: stat.color,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 'var(--space-1)'
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'var(--gray-600)',
              fontWeight: '500'
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Insights */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        border: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          🔍 Quick Insights
        </h3>
        
        <div className="space-y-3">
          {[
            { icon: '⚠️', text: 'Critical differences found in liability and termination clauses', type: 'warning' },
            { icon: '💰', text: 'Payment terms vary significantly across documents', type: 'info' },
            { icon: '🔒', text: 'Intellectual property ownership models differ substantially', type: 'danger' },
            { icon: '✅', text: 'Most general terms and conditions are consistent', type: 'success' }
          ].map((insight, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--gray-200)'
            }}>
              <span style={{ fontSize: '18px' }}>{insight.icon}</span>
              <span style={{ color: 'var(--gray-700)', fontSize: '14px' }}>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderDetailedComparison = () => (
    <div style={{
      background: 'white',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--gray-200)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        padding: 'var(--space-4) var(--space-6)',
        background: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-200)'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--gray-900)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          ⚖️ Key Differences Analysis
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ background: 'var(--gray-100)' }}>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--gray-700)',
                fontSize: '14px',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                Category
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--gray-700)',
                fontSize: '14px',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                Document 1
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--gray-700)',
                fontSize: '14px',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                Document 2
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--gray-700)',
                fontSize: '14px',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                Document 3
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--gray-700)',
                fontSize: '14px',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                Risk Level
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.keyDifferences.map((diff, index) => (
              <tr key={index} style={{
                borderBottom: index < comparisonData.keyDifferences.length - 1 ? '1px solid var(--gray-100)' : 'none'
              }}>
                <td style={{
                  padding: 'var(--space-4)',
                  fontWeight: '600',
                  color: 'var(--gray-900)',
                  fontSize: '14px',
                  verticalAlign: 'top'
                }}>
                  {diff.category}
                </td>
                <td style={{
                  padding: 'var(--space-4)',
                  color: 'var(--gray-700)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  verticalAlign: 'top',
                  maxWidth: '200px'
                }}>
                  {diff.document1}
                </td>
                <td style={{
                  padding: 'var(--space-4)',
                  color: 'var(--gray-700)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  verticalAlign: 'top',
                  maxWidth: '200px'
                }}>
                  {diff.document2}
                </td>
                <td style={{
                  padding: 'var(--space-4)',
                  color: 'var(--gray-700)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  verticalAlign: 'top',
                  maxWidth: '200px'
                }}>
                  {diff.document3}
                </td>
                <td style={{
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                  verticalAlign: 'top'
                }}>
                  <span style={{
                    padding: 'var(--space-1) var(--space-2)',
                    background: getRiskBg(diff.riskLevel),
                    color: getRiskColor(diff.riskLevel),
                    borderRadius: 'var(--radius)',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {diff.riskLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderRiskAnalysis = () => (
    <div className="space-y-6">
      {comparisonData.riskAnalysis.map((risk, index) => (
        <div
          key={index}
          style={{
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--gray-200)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--gray-900)',
              margin: 0
            }}>
              {risk.riskType}
            </h4>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-4)'
          }}>
            {[
              { label: 'Document 1', level: risk.document1 },
              { label: 'Document 2', level: risk.document2 },
              { label: 'Document 3', level: risk.document3 }
            ].map((doc, docIndex) => (
              <div
                key={docIndex}
                style={{
                  padding: 'var(--space-3)',
                  background: getRiskBg(doc.level),
                  borderRadius: 'var(--radius-lg)',
                  textAlign: 'center',
                  border: `1px solid ${getRiskColor(doc.level)}`
                }}
              >
                <div style={{
                  fontSize: '12px',
                  color: 'var(--gray-600)',
                  marginBottom: 'var(--space-1)'
                }}>
                  {doc.label}
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: getRiskColor(doc.level)
                }}>
                  {doc.level} Risk
                </div>
              </div>
            ))}
          </div>

          <p style={{
            fontSize: '14px',
            color: 'var(--gray-700)',
            lineHeight: 1.6,
            margin: 0,
            padding: 'var(--space-3)',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--gray-200)'
          }}>
            {risk.details}
          </p>
        </div>
      ))}
    </div>
  )

  return (
    <div className="content-section">
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--space-8)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'var(--gradient-info)',
          borderRadius: 'var(--radius-2xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
          fontSize: '32px',
          color: 'white',
          boxShadow: 'var(--shadow-lg)'
        }}>
          ⚖️
        </div>
        <h2 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-2)'
        }}>
          Document Comparison Results
        </h2>
        <p style={{
          color: 'var(--gray-600)',
          fontSize: '16px',
          lineHeight: '1.6',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          AI-powered analysis comparing your documents with key differences, risk assessments, and actionable insights.
        </p>
      </div>

      {renderTabNavigation()}

      {activeView === 'overview' && renderOverview()}
      {activeView === 'detailed' && renderDetailedComparison()}
      {activeView === 'risks' && renderRiskAnalysis()}
    </div>
  )
}

export default ComparisonResults