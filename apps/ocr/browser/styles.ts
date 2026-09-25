import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  root: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#232824',
    backgroundColor: '#f5f6f3',
    fontSynthesis: 'none',
    minHeight: '100vh'
  },
  main: {
    maxWidth: '1440px',
    margin: 'auto',
    padding: {
      default: '44px 48px',
      '@media (max-width: 760px)': '24px 16px'
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: {
      default: 'center',
      '@media (max-width: 760px)': 'flex-start'
    },
    gap: '24px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#dce0d9',
    paddingBottom: '24px',
    flexDirection: {
      default: null,
      '@media (max-width: 760px)': 'column'
    }
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: '750',
    letterSpacing: '0.16em',
    color: '#537b42',
    marginBottom: '10px'
  },
  heading: {
    marginTop: '0'
  },
  paragraph: {
    lineHeight: '1.65',
    marginTop: 0
  },
  muted: {
    color: '#6b736c',
    fontSize: '14px',
    margin: '8px 0 0'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  actionLink: {
    textDecoration: 'none'
  },
  error: {
    color: '#b13232',
    minHeight: '20px',
    margin: '12px 0'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    fontSize: '13px',
    fontWeight: '600'
  },
  control: {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    padding: '10px 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d6dcd3',
    borderRadius: '8px',
    backgroundColor: 'white',
    minWidth: '0',
    color: 'inherit',
    outline: {
      default: null,
      ':focus': '2px solid #638b50'
    },
    outlineOffset: {
      default: null,
      ':focus': '2px'
    }
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(4, 1fr)',
      '@media (max-width: 760px)': '1fr 1fr'
    },
    gap: {
      default: '16px',
      '@media (max-width: 760px)': '8px'
    },
    marginBottom: '24px'
  },
  statCard: {
    padding: {
      default: '20px 24px',
      '@media (max-width: 760px)': '16px'
    },
    backgroundColor: 'white',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e5db',
    borderRadius: '12px'
  },
  statLabel: {
    fontSize: '13px',
    color: '#687465'
  },
  statValue: {
    display: 'block',
    marginTop: '8px',
    fontSize: '28px',
    fontWeight: '650'
  },
  upload: {
    backgroundColor: '#eef2e9',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dce4d4',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '26px'
  },
  uploadSummary: {
    fontSize: '14px',
    fontWeight: '650',
    cursor: 'pointer'
  },
  uploadParagraph: {
    fontSize: '13px',
    color: '#576451',
    margin: '14px 0'
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: {
      default: '2fr 1fr 1fr 1fr',
      '@media (max-width: 1100px)': '1fr 1fr',
      '@media (max-width: 760px)': '1fr'
    },
    gap: '14px'
  },
  cropFields: {
    display: 'grid',
    gridTemplateColumns: {
      default: '70px repeat(4, 1fr)',
      '@media (max-width: 760px)': 'repeat(2, 1fr)'
    },
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px'
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: {
      default: null,
      '@media (max-width: 760px)': 'wrap'
    }
  },
  filterLabel: {
    minWidth: {
      default: '150px',
      '@media (max-width: 760px)': '120px'
    },
    flex: {
      default: null,
      '@media (max-width: 760px)': '1'
    }
  },
  workspace: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) 380px',
      '@media (max-width: 1100px)': 'minmax(0, 1fr) 340px',
      '@media (max-width: 760px)': '1fr'
    },
    gap: '24px',
    alignItems: 'start'
  },
  gallery: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 1100px)': 'repeat(2, minmax(0, 1fr))'
    },
    gap: '12px'
  },
  sample: {
    textAlign: 'left',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dce1d7',
    borderRadius: '10px',
    padding: '12px',
    backgroundColor: 'white',
    cursor: 'pointer',
    color: 'inherit',
    overflow: 'hidden'
  },
  selectedSample: {
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#65844e',
    padding: '11px',
    backgroundColor: '#fafff5'
  },
  sampleTitle: {
    display: 'block',
    fontSize: '14px',
    margin: '12px 0 6px',
    overflowWrap: 'anywhere'
  },
  sampleMeta: {
    fontSize: '11px',
    color: '#70786b'
  },
  thumb: {
    height: '74px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6e9e1',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  thumbnailImage: {
    maxWidth: '100%',
    maxHeight: '64px',
    imageRendering: 'pixelated'
  },
  editor: {
    padding: '24px',
    backgroundColor: 'white',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dce1d7',
    borderRadius: '12px',
    position: {
      default: 'sticky',
      '@media (max-width: 760px)': 'static'
    },
    top: '20px',
    gridRow: {
      default: null,
      '@media (max-width: 760px)': '1'
    }
  },
  editorHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px'
  },
  badge: {
    fontSize: '11px',
    color: '#647659',
    backgroundColor: '#edf3e6',
    borderRadius: '20px',
    padding: '6px 10px'
  },
  largePreview: {
    backgroundColor: '#e6e9e1',
    minHeight: '130px',
    padding: '20px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    marginBottom: '24px',
    overflow: 'hidden'
  },
  previewImage: {
    width: '100%',
    imageRendering: 'pixelated'
  },
  editorActions: {
    margin: '14px 0 24px'
  },
  labelInput: {
    fontSize: '18px'
  },
  metadata: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr',
    gap: '12px',
    fontSize: '12px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: '#e5e8e0',
    paddingTop: '20px',
    marginTop: '22px'
  },
  metadataLabel: {
    color: '#77816f'
  },
  metadataValue: {
    margin: '0',
    overflowWrap: 'anywhere'
  },
  originalLink: {
    fontSize: '13px',
    color: '#496c35'
  },
  editorStatus: {
    fontSize: '13px',
    margin: '16px 0 0'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '18px',
    marginTop: '32px',
    fontSize: '13px'
  },
  empty: {
    gridColumn: '1/-1',
    backgroundColor: 'white',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: '#c8d3bd',
    borderRadius: '12px',
    padding: '70px 24px',
    textAlign: 'center',
    color: '#65735a'
  },
  emptyParagraph: {
    fontSize: '14px',
    margin: '12px 0'
  },
  login: {
    margin: {
      default: '70px auto',
      '@media (max-width: 760px)': '36px auto'
    },
    maxWidth: '480px',
    backgroundColor: 'white',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dce1d7',
    borderRadius: '16px',
    padding: {
      default: '42px',
      '@media (max-width: 760px)': '28px'
    }
  },
  loginParagraph: {
    fontSize: '14px',
    color: '#6b736c',
    margin: '18px 0 28px'
  },
  cropHeading: {
    gridColumn: {
      default: null,
      '@media (max-width: 760px)': '1/-1'
    }
  }
})
