"use client";

import { useEffect, useState } from 'react';
import { createClient } from '../utils/supabase/client';

/**
 * Devuelve el logo y nombre de la organización del usuario autenticado.
 * Si la org no tiene logo o nombre configurado, cae a los valores de OPERPAL.
 *
 * Uso:
 *   const { logoUrl, orgName } = useOrgLogo();
 *   <img src={logoUrl} alt={orgName} />
 */
export function useOrgLogo() {
  const [logoUrl, setLogoUrl] = useState('/logo-operpal-icon.png');
  const [orgName, setOrgName] = useState('OPERPAL');

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from('company_profile')
      .select('logo_url, company_name')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url)     setLogoUrl(data.logo_url);
        if (data?.company_name) setOrgName(data.company_name);
      });
  }, []);

  return { logoUrl, orgName };
}
