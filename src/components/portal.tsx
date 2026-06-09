import React from 'react';
import { Redirect } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

function Portal() {
  const url = useBaseUrl('/docs/category/keystone-3-pro/');
  return (
    <>
      <div style={{display: 'none'}}>
        <a href={url}>Keystone 3 Pro Documentation</a>
      </div>
      <Redirect to={url} />
    </>
  )
}

export default Portal;
